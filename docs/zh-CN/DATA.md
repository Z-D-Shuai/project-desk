# 数据与文件组织

## v1.0.0 / Phase 8.2 当前补记

业务 schema 仍为 **007**，34 张业务/迁移表，未改写既有 SQL 迁移。下文按引入阶段保留历史数据说明。

- 数据库切换前写 `.restore-state.json`：version、previous/staged 文件名及 SHA-256；fsync 完成才移动主库。打开主库前检查标记，核验摘要、SQLite 完整性、外键和 schema_migrations；明确可恢复才接续，状态不明拒绝创建/覆盖数据库。确认后移除标记，保留安全备份。旧版无标记但存在恢复残留且主库缺失时拒绝新建空库，需保留证据后人工确认。
- `.reminder-data-mutex.sqlite` 为独立运行互斥文件，使用 SQLite 排他事务，不是第二份业务库。关闭/退出释放系统锁；应用整库备份不打包它，也不依赖它恢复业务记录。旧 `.reminder-data.lock` 继续记录 PID/token；空锁有 2 秒初始化保护，被接管的遗留元数据改名 `.abandoned-*` 留存。存活旧持有者仍会等待，持锁业务异常不会自动重放。
- 文件夹回收记录的 `payload` 增加可选 `project_ids`，只记录回收时的项目所有者。恢复到其他位置时，同一事务更新这些仍指向原路径的项目和文件登记；新增的旧位置使用者不被改写。旧 payload 缺此字段时按原路径前缀兼容推导，无需迁移。
- 文件去重复用前检查磁盘当前摘要/大小；发现外部改写时更新 `file_objects` 的 sha256/size/mime/revision，再判断是否真的重复，不触碰开发日志或实际跟进时间。
- `/api/health.version` 与 `/api/bootstrap.storage.appVersion` 来自 package.json；业务 schemaVersion 仍是 007。版本号不等同于数据库迁移号。

本阶段正式 SQLite/WAL/SHM 指纹与修改前一致；未连接正式数据库。新副本完整性检查受目录创建权限限制未完成；隔离自动测试的完整性/外键与备份恢复通过，不能代替当前正式库的新完整性检查。详见 `PHASE82_REPORT.md`。

数据库：`data/project-desk.sqlite`，SQLite STRICT 表。标识使用 TEXT，后续由服务生成 UUID；时间字段为 ISO 8601，后续以 UTC 保存并在界面按本地时区显示。

| 表 | 字段/职责（阶段增量详见下文） |
| --- | --- |
| schema_migrations | 迁移文件名、执行时间；仅工程元数据 |
| settings | key/value；当前仅 theme，默认 system（未设置时无需写入） |
| projects | id、名称、简介、状态、0–100 整数进度、文件夹路径、创建/更新时间、category_id、archived_at、deleted_at、revision |
| project_categories | id、名称、图标、favorite、sort_order、revision、创建/更新时间 |
| journal_entries | id、project_id、内容、发生/创建/更新时间 |
| resources | 资料元数据、类型/网址/正文、分类、状态/收藏、时间、软删除、版本及当前资产引用 |
| project_resources | 项目与资料的多对多关联 |
| file_assets | 资料关联、存储模式、内容相对路径、原文件名、MIME、大小、摘要、创建时间 |

状态与进度独立，不通过进度自动改变状态。项目状态 not_started/in_progress/paused/completed/abandoned。外键删除采用 RESTRICT，避免意外级联删除；后续业务删除应在事务中显式处理关联。

阶段 1 新增 `002-project-archive.sql`，原 `001-foundation.sql` 不变；已有项目默认未分类、未归档、未删除，revision=1。标签/收藏夹、参与者、提醒、资料状态、封面等继续在所属阶段通过新增迁移实现：

- 分类是一种主要归类，按项目/资料划分作用域；标签允许多选；收藏夹是用户整理集合，三者分别建表。
- journal_entries 是项目详情和跟进中心的共同数据源；草稿另建表。
- 一项资料可关联多个项目；文件资产区分复制管理和外部引用。解除记录关联不直接删除真实文件。
- 当前托管文件在数据根目录 assets 按内容摘要组织；外部存储选择和引用模式留待阶段 4。程序源码、数据库和大文件分离。
- 阶段 2、3 分别新增 003、004；不得改写已执行迁移。

## 阶段 1 数据规则

- 一个项目可有一个主要分类，NULL 为“未分类”。分类名称去首尾空格后非空、最多 40 字符，SQLite NOCASE 索引避免同名（ASCII 大小写不敏感）。不限制用户分类数量。
- 分类图标为内置键（folder/code/design/book/camera/globe/idea）或自定义符号。界面自定义符号最多 4 字符，服务端通用图标标识最多 24 字符；不接受或执行 HTML/SVG 代码。
- favorite 只控制快捷入口，sort_order 只控制顺序；两者不改变项目分类和状态。上移/下移排序在事务内更新完整分类序列。
- 项目名称 1–120 字符，简介最多 5000 字符，进度必须为 0–100 整数。状态、进度、分类、归档互不推导。时间由服务端生成 UTC ISO 值，界面按本机时区显示。
- archived_at 为归档时间或 NULL；恢复只清除归档标记。编辑、归档/恢复和分类转移更新 updated_at，created_at 不变。
- deleted_at 为软删除标记。删除只标记该行，不删除原数据和文件；常规列表、详情、分类计数与 Dashboard 排除已删除行。当前不提供软删除恢复接口/界面。
- 分类删除以 BEGIN IMMEDIATE 事务先转移全部引用（含归档及已软删除行），再删除分类；无效目标会整体回滚。转移到 NULL 表示未分类。
- revision 为递增版本号。项目更新/归档/删除及分类编辑要求客户端携带当前 revision，通过条件更新防止旧窗口覆盖新数据。分类转移也递增受影响项目的版本。
- Dashboard 总数与五种状态计数均包含归档项目、排除已删除项目，另有 archived 计数。最近项目按更新时间降序、最多 5 项。

## 阶段 1 HTTP 接口（历史范围）

除下文阶段 3 文件上传和资料元数据上限外，写入要求同源 Origin 和 application/json，限制请求体 32 KiB；无效输入 400、未找到 404、版本冲突/同名分类 409。

| 接口 | 职责 |
| --- | --- |
| GET /api/bootstrap | 设置、存储版本 002、项目统计、全部可见项目及分类 |
| GET /api/projects | q/category/status/archive/sort/order 筛选排序；archive=active/archived/all，默认 active |
| POST /api/projects | 创建项目 |
| GET /api/projects/:id | 读取详情 |
| PUT /api/projects/:id | 更新名称/简介/状态/进度/分类，携带 revision |
| PUT /api/projects/:id/archive | archived 布尔值与 revision |
| DELETE /api/projects/:id | 携带 revision，软删除 |
| GET/POST /api/categories | 列出/新增项目分类 |
| PUT /api/categories/:id | 修改名称/图标/收藏，携带 revision |
| PUT /api/categories/reorder | ids 完整顺序数组 |
| DELETE /api/categories/:id | replacement_id（分类 ID 或 null）、revision |
| PUT /api/settings | 原有主题保存接口 |

当前浏览器从 bootstrap 读取项目集合，筛选和每页 30 项展示在本地完成；没有服务端分页，适用于个人规模的数据量。未来数据量明显增长时再增加服务端分页和轻量查询，不改变 SQLite 数据来源。此处为阶段 1 的读取方式；阶段 2/3 新接口见下文。


## 阶段 2：003-development.sql

保留 001、002 及既有项目/日志内容，新增：

| 数据表 | 职责 |
| --- | --- |
| participants | 自定义 name/type/role、revision、创建/更新时间、deleted_at |
| project_participants | project_id + participant_id 复合主键，整个项目的参与名单 |
| journal_participants | journal_id + participant_id 复合主键，单次日志的实际参与者 |
| project_workspaces | 每项目一行：current_work/problems/ideas/next_step、revision、updated_at |

journal_entries 增加 title/files/result/problems/next_step/notes、important、revision、deleted_at。现有 content、occurred_at 和创建/更新时间不变。标题最多 200 字符，其余文本最多 5000 字符，至少填写内容或标题；仅填标题时内容以标题保存。参与者名称 80 字符、类型 40 字符，不预置品牌或类型。请求体仍限制 32 KiB，表单超限会显示错误并保留输入。

项目总体名单与日志名单分别保存。保存日志时事务写入日志和参与者链接，并将新参与者补入总体名单；移除仍被未删除日志引用的项目参与者返回 409。删除日志不清除项目曾使用过的参与者。删除参与者为软删除，历史引用保留；编辑旧日志可保留原有已删除参与者，但不能新增已删除参与者。当前名称/类型修改会反映到其历史关联，不保留每次改名的快照。

所有开发写操作使用事务与 revision 冲突检查；工作备忘首次保存 revision=0，后续携带当前版本。日志/备忘/关联变更更新项目 updated_at 与 revision，不改变项目状态、进度、分类或归档。软删除项目不抹去其历史，但全局读取和统计排除该项目内容。

新增接口：GET/POST /api/participants、PUT/DELETE /api/participants/:id；GET/POST /api/journals、PUT/DELETE /api/journals/:id；PUT /api/projects/:id/participants；PUT /api/projects/:id/workspace。写请求仍要求同源 JSON。bootstrap 新增 participants（含历史已删除项）、memberships、journals（含 participant_ids）、workspaces；数据版本 003。各页面读取同一套数据，时间线筛选在浏览器执行，未增加日志分页。

阶段 2 完成时后续迁移从 004 开始；不要改写已执行迁移。日期存 UTC，界面与日期筛选使用本机时区。备忘不会写入 journal_entries。阶段 2 不包含附件、媒体文件或资料库写入；这些能力由下述阶段 3 增量提供。

## 阶段 3：004-library.sql（当前）

不修改 001–003；SQLite 继续保存元数据，媒体文件不进入 BLOB。

| 表 | 新增内容 / 职责 |
| --- | --- |
| resources | category_id、platform、notes、status、favorite、last_viewed_at、deleted_at、revision、asset_id；保留 title/kind/source_url/content/created_at/updated_at |
| resource_categories | id/name/icon/sort_order/revision/created_at/updated_at；单一主要分类 |
| resource_tags | 同上；多选特征标签，独立名称空间 |
| resource_collections | 同上；多选主题集合，独立名称空间 |
| resource_tag_links | resource_id + tag_id 联合主键 |
| resource_collection_links | resource_id + collection_id 联合主键 |
| project_resources | 继续沿用 project_id + resource_id，多项目共享资料 |
| file_assets | 新增 original_name、mime、size、sha256；资源关联、存储模式、相对 path、创建时间仍保留 |

kind 为 video_link/image/web/text/file/video；status 为 unsorted/to_view/learning/learned/used/archived。favorite、status、分类、标签、收藏夹和项目状态均独立。收藏时间使用 created_at，永不因编辑改变；last_viewed_at 在查看详情、打开网址或下载时更新，不递增 revision、不改变 updated_at 或学习状态。是否收藏不影响资料是否入库。

标题 1–160 字符，文字内容最多 30000 字符，备注/用途最多 5000 字符，来源平台最多 100 字符（自由文本，不预置平台表）。文字资料正文必填；网址只接受 http/https，保存规范化 URL，非删除记录中完全相同 URL 拒绝重复新增并提示复用。一个资料允许最多 200 个同类关联。分类/标签/收藏夹名称 1–40 字符，分表 NOCASE 唯一；图标 1–24 字符，不当作 HTML 执行。

分类删除先在事务内转移所有引用（包括软删除资料），目标为另一个分类或 NULL；标签/收藏夹删除只解除对应链接，资料本体保留。资料软删除保留底层所有历史关联，读取时隐藏。编辑资料保留已软删除项目的原关联；编辑项目关联保留已软删除资料的原关联。关联增删更新相关版本和更新时间，旧表单返回 409。

文件默认位于 data/assets/<SHA-256>（或 PROJECT_DESK_DATA_DIR/assets），file_assets.path 存 assets/<摘要>；文件不使用用户输入路径，文件名仅作下载元数据。当前仅 managed 复制模式。每次上传建立新资产记录，resources.asset_id 指向当前资产；相同字节共享内容文件，旧资产保留。资源上传前可存在“无文件”记录，失败可补传。上传不会移动或修改源文件。

单文件上限 512 MiB，空文件拒绝。PNG/JPEG/GIF/WebP 图片识别，MP4/WebM/Ogg 视频容器识别；并不保证内部编码可播放。其他附件固定 application/octet-stream 并下载。读取限制在受管理文件目录，仅开放未删除资料的当前资产，支持 GET/HEAD 和单段 Range；缺失文件返回 404，界面可编辑补传。临时上传文件通常在 finally 中清理；进程异常中断和并发冲突可能遗留文件，不在本阶段自动清理。

### 阶段 3 HTTP 接口

| 接口 | 职责 |
| --- | --- |
| GET /api/resources、GET /api/resources/:id | 可见资料与关系数组、当前文件描述 |
| POST /api/resources、PUT /api/resources/:id | 新增/编辑元数据；编辑带 revision |
| DELETE /api/resources/:id | revision 软删除，保留磁盘内容 |
| POST /api/resources/:id/view | 更新最后查看时间 |
| PUT /api/resources/:id/favorite | favorite 布尔值及 revision |
| GET/POST /api/library/{categories,tags,collections} | 分别读取/新增整理对象 |
| PUT/DELETE /api/library/{type}/:id | revision 编辑/删除；分类删除需 replacement_id |
| PUT /api/library/{type}/reorder | 完整 ids 顺序数组 |
| PUT /api/projects/:id/resources | resource_ids 与项目 revision，修改该项目引用 |
| POST /api/resources/:id/file?revision=N | 同源 octet-stream 二进制，X-File-Name 为 URL 编码原文件名 |
| GET/HEAD /api/assets/:assetId | 读取当前资产；?download 强制下载 |

资料新增/编辑 JSON 上限 256 KiB，容纳 30000 字中文正文；其余 JSON 接口保持 32 KiB。上传不经过 JSON 读取器。写请求仍要求同源 Origin，上传同时要求精确 application/octet-stream。无效输入 400、源不合法 403、不存在 404、版本/同名/重复 URL 冲突 409、超限 413、非法范围 416。

bootstrap 当前数据版本 004，新增 resources（含 tag_ids/collection_ids/project_ids）、libraryCategories、libraryTags、libraryCollections。summary.resources 排除软删除。前端从同一 bootstrap 读取并筛选、每页 30 份，当前没有服务端查询分页或全文索引；个人大数据量下可后续优化，不维护副本。

后续新增迁移从 005 开始。阶段 4 再处理外部存储设置、引用模式、文件夹、批量导入、完整删除和恢复策略；本阶段不自动清理旧资产或磁盘文件。

## 阶段 4：005-files.sql（当前）

旧字段不删除或改写；新增表及链接：

| 表 | 职责 |
| --- | --- |
| storage_roots | id/name/role/path/revision/created_at；image/video/file/project/other 用途，@data/ 解析为当前数据目录 |
| file_objects | 文件本体：root_id/path/storage_mode/name/mime/size/sha256/revision/created_at/deleted_at/trash_path/purged_at |
| file_assets.file_id | 指向共享本体，旧 path/原文件名等继续保留历史兼容；读取以本体为准 |
| storage_folders | 工具登记的文件夹，root_id/path 联合主键 |
| file_trash | 文件或目录的 original_path/stored_path、对象/子目录恢复清单、删除时间；外部引用只标记引用关系 |
| disk_jobs | 持久化移动计划、状态及异常，用于中断恢复和保留副本提示 |

005 将已有资产按存储模式和路径归并为本体，不移动旧字节。托管路径相对 storage_roots，引用路径为完整绝对路径。实际资源仍由 resources.asset_id 指向资产，多个资源可共享本体；项目通过已有 project_resources 共享资料。

资料软删除继续使用 resources.deleted_at；回收站可恢复。永久删除资料行前删除关联和历史资产登记，file_objects 与真实文件保留。文件回收由本体 deleted_at/trash_path 和 file_trash 管理，影响所有共享资料。永久清理仅删除独立托管回收路径内字节，标记 purged_at；外部引用不删除源文件。本阶段文件回收站独立于 Windows 系统回收站。

复制支持自动按类型选目录或显式指定根和子目录；同内容复用现有可用资料，原状态/分类不改，新增项目引用合并。浏览器上传仍为 512 MiB；路径复制/引用流式读取摘要，不走 JSON 大文件通道。批次最多 200 个文件，逐项返回成功/重复/错误，不回滚同批已成功项。同名不同文件自动避免覆盖。

目录迁移要求目标为空；文件和目录移动更新本体及相应项目目录/引用。重新定位默认核对摘要，不一致需 allow_changed 明确确认。引用位于配置根内时可重新登记为托管，但不会复制或删除旧位置。普通外部引用没有原文件改名、移动或删除按钮。

新增接口：GET /api/filesystem、GET /api/trash；POST /api/filesystem/{choose-list,browse,folder,move,trash,import,reveal,upload}；POST/PUT/DELETE /api/storage-roots[/:id]；PUT /api/files/:id/relink；PUT /api/projects/:id/folder；POST /api/trash/:id/{restore,purge}；POST /api/trash/empty；POST /api/backups/{create,inspect,restore}。均保持本机 Host 和同源写入保护，选择器也要求同源 POST。upload 使用 octet-stream，其余为 JSON。

bootstrap 为 005，增加 fileSystem（根、文件、可用性、使用范围、项目目录和待检查任务）；resources 增加 file_id/实际模式/文件回收标记。路径和大小来自文件本体，不使用浏览器临时存储作为数据源。

备份 manifest 记录 format=project-desk-backup、version=1、schema=005、数据库摘要/大小、根映射、文件清单/摘要、缺失文件与外部引用路径。blobs 按内容摘要复用；托管回收文件和历史资产也纳入。恢复重定位 storage_roots 与托管项目目录，保留外部路径。恢复前快照在 data/recovery；数据库切换前后的文件目录都保留，避免覆盖原文件。备份文件不加密，恢复仅接受经过完整性校验的同版本目录包。

后续迁移从 006 开始；阶段 5 提醒规则尚未建立。

## 阶段 5：006-reminders.sql（当前）

新增 projects.last_followed_at；不修改普通项目更新时间语义。

| 表 | 职责 |
| --- | --- |
| reminder_settings | 单行：全局、项目、资料开关，project_days/resource_days/repeat_days/snooze_days、daily_time、revision |
| reminder_rules | kind=project/resource/category + entity_id 主键；可空继承周期、重复间隔、暂停、稍后截止、已处理时间、revision |
| reminder_history | 对象类型/ID、当时标题、动作、UTC 时刻及说明；界面最近 300 条 |
| reminder_deliveries | 通知批次 id、created_at、pending/sent/failed、对象快照、错误与完成时间 |
| reminder_notified | kind/entity_id 当前 cycle、上次预留/投递时间、delivery_id，防重复与冷却 |
| reminder_runtime | desktop_enabled/desktop_port/last_check_at 等运行元数据；实际系统任务状态须向 Windows 查询 |

项目 anchor 是创建、last_followed_at、有效日志事件/实际保存、非空备忘的最大时间，普通项目 updated_at 不参与。资料 anchor 为 created_at/last_viewed_at 较晚值。基础到期=anchor+周期；实际到期取基础到期、handled_at+重复间隔、snoozed_until 的最大值。周期按 24h，展示与日期筛选按本机本地时间。未来事件时间不用于提前推导已跟进。

单条周期覆盖分类再覆盖全局；继承分类周期时同时受分类暂停约束。项目仅进行中未归档默认参与；资源 learned/used/archived 不参与。规则、项目状态、进度、收藏标记互相独立。动作使用事务并核对数据及规则 revision。去查看只更新 last_viewed_at 和处理历史；继续跟进只更新独立实际跟进时刻；归档、学习、使用、删除只能由明确动作触发，不删除字节。

相同 due cycle 在重复间隔内不会再次弹窗。Windows 失败后移除该批次预留，下一检查可重试；pending 保留预留，防止崩溃后不确定重投。sent 表示 OS 接受，不等于用户已阅读或资料已学习。一次多条汇总到一条通知，标记和组名让旧汇总可替换，不为每个对象创建任务。

新增 GET /api/reminders；PUT /api/reminders/settings、/rule；POST /api/reminders/action；POST /api/reminders/windows/{install,status,test,run,uninstall}。bootstrap 增加 reminders，数据版本 006。停止接口 POST /api/shutdown 只在实际服务运行时开放，仍要求本机 Host、同源 JSON 和明确确认字段，供 stop.bat 使用。

Windows 任务及协议是操作系统资源，不随 SQLite 备份自动注册。005 包恢复前升级 006；006 表纳入备份。恢复关闭当前任务，候选库 desktop_enabled=0，之后明确安装。data/reminders 中的 Windows 配置和诊断日志为本机辅助文件，核心规则/状态/历史均在 SQLite。

下次迁移从 007 开始；阶段 6 未开始。


## 阶段 6：统计与预设（007-experience.sql）

旧表不重建，追加以下独立数据：

| 表/字段 | 职责 |
| --- | --- |
| usage_sessions | 页面会话 ID、首次加载/最近有效活动/结束毫秒时间；启动次数按加载数 |
| usage_visits | 项目访问 ID、会话、项目外键与打开时间；同一次访问重渲染不增加 |
| usage_blocks | scope=app 或 project:ID 的已合并有效时间区间，start/end 为 UTC epoch 毫秒 |
| usage_receipts | 客户端片段 ID 去重；收据保留两天，历史使用区间长期保留 |
| preset_defaults | 17 条初始默认元数据：6 项目分类、6 参与者、5 平台，恢复默认的补缺依据 |
| presets | kind、名称、图标、参与者类型、顺序、默认来源、图片文件 ID、revision 与时间；同组名称 NOCASE 唯一 |
| project_categories.icon_file_id | 选用时复制的图片引用，不引用模板 ID |
| participants.icon / icon_file_id | 参与者自身图标和图片；旧记录默认 idea |
| resources.platform_icon / platform_image_id | 资料自身的平台图标和图片；删除平台预设不影响历史 |
| storage_roots: preset-images | 默认 @data/preset-images，独立于业务资料，不生成虚构 resource 记录 |

默认值只是预设数据，不自动生成业务分类、参与者或资料。恢复默认只补齐缺失名称；既有记录、编辑内容、用户顺序和自定义项保留。原名字被改名时，改名项仍在，恢复会补回原默认名。图片不随预设删除而删除；历史引用纳入文件使用提示和备份。名称/图标经转义展示，不接受上传 SVG/HTML 执行内容。

所有统计数据独立保存，不更新项目/日志。服务端合并重叠区间而不简单相加，客户端批次可安全重试；项目软删除不抹掉历史统计。每日统计使用本机时区偏移，今日/7 天/30 天包含今天；无历史值显示 0 或尚无。平均单次=已合并有效时间÷对应加载/访问数，含进行中的会话。硬退出最后心跳的现实限制见 README。

主要新接口：POST /api/usage/heartbeat；GET /api/usage?offset= 与 /api/usage/projects/:id?offset=；GET /api/search?q=；GET/POST/PUT/DELETE /api/presets[/:id]，POST /:id/apply，POST/DELETE /:id/image，PUT /reorder、POST /restore。GET/HEAD /api/preset-images/:fileId 仅读取仍被预设或历史业务引用的安全图片。写入保持同源校验，预设图片二进制最多 2 MiB，其他上传上限仍为 512 MiB。

备份校验现接受 005/006/007，完整 SQLite 自动包含统计和预设；全部托管图片通过 file_objects 摘要校验，旧包迁移补入新表。正式数据升级已与变更前 28 张表的原字段/原记录逐项比对一致。


## 阶段 7 数据边界

v0.7.0 是设计阶段，数据版本仍为 007，无新表、字段或迁移；原后端文件保持完全一致。主题仍由 SQLite settings.theme 保存。视图、单项目置顶和最近数量属于前端偏好，保存于以实际数据库路径分区的 localStorage，不写项目/日志，不改变 updated_at / revision / 闲置锚点，也不包含在现有 SQLite 备份中。换浏览器或清除站点数据后恢复界面默认，不丢失业务资料。未创建优先级、任务或开发阶段模型，不补造任务计数。
