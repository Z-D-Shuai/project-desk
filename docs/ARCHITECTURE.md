# 阶段 0 架构决定

> 当前版本 v1.0.0，Phase 8.2 修复完成，等待最终验收。本文原阶段决定按历史保留；当前能力应结合后续增量和 README 阅读，阶段 0 的禁用搜索等描述不是当前限制。

## Phase 8.2 局部可靠性修复

继续 Node.js 24 + 原生 ES Modules / HTML / CSS + 内置 SQLite、本地 HTTP；无第三方运行依赖，无新业务表或迁移。

- `assets.mjs` 对零字节响应直接结束；HTTP 异常处理区分 headersSent，避免二次发送响应。
- `restore-state.mjs` 在数据库重命名前持久化切换标记和分块计算的摘要，`openDatabase` 在创建/连接前恢复明确匹配的状态，旧版不明残留拒绝创建空库。完整恢复仍由 backups.mjs 完成文件校验、目录重映射及安全备份。
- `storage.mjs` 继续使用原磁盘操作计划/事务，补上回收目录改址时的原项目路径关系；去重前实际读取候选文件，失效候选不复用，不覆盖原位置的其他文件。
- `data-lock.mjs` 使用独立 SQLite 排他事务做跨进程锁，避免空 JSON 文件令恢复永久阻塞；旧 PID 锁兼容，诊断元数据保留。运行互斥与业务数据库切换相互独立。
- `launch.mjs` 核对健康版本、bootstrap 数据库路径后才复用服务，不关闭其他工作区。`version.mjs` 从 package.json 读取当前版本，健康与引导响应共享来源。
- `studio.js` 在主题保存完成/失败时同步表单，系统外观改变保留草稿；不改原 Canvas 或 CSS。

验证、权限限制和保留证据见 `PHASE82_REPORT.md`。本阶段不是新的全面审计，也未更改 Windows 任务或通知协议。

日期：2026-11-16。范围：架构与基础框架。

## 选择

使用已有 Node.js 24.x 的 HTTP、文件系统、SQLite 能力，配合原生 ES Modules、HTML/CSS。当前零第三方运行依赖、无需构建。原生模块足以支撑阶段 0；不提前引入桌面壳、云服务、AI API 或复杂状态框架。

界面 / HTTP 服务 / 数据层分开：pages 负责页面、ui 负责表现、services 负责请求，server 负责数据与未来文件操作。后续页面复杂度达到需要时可以局部采用成熟组件框架，而不改变持久化结构或服务接口。

Node 内置 SQLite 接口仍处于活跃开发阶段，因此明确使用 24.x，并将调用封装在 database.mjs。未来更换驱动无需改变页面。SQLite 是磁盘数据库，不依赖 localStorage。

总纲要求侧栏和顶部工具区，因此保留顶栏；搜索明确禁用并标注后续开放。基础视觉采用 Achromatic ledger（seed 1215761365）的中性色比例，保留 Windows 系统字体与中性灰，避免在最终视觉方案确定前锁定强风格。产品识别来自文件夹标记及“记录项目、保存资料、追踪历程、定期回访”的工作台分区。无外部字体、图片、远程 CDN 或示例数据。

## 开源参考评估

仅参考功能结构，没有复制或引入任何仓库代码。

- [Personal OS](https://github.com/im4aLL/personal-os)：个人生产力工具方向可参考；当前仓库信息不足以直接作为稳定底座，不采用整套工程。
- [LifeOS](https://github.com/adrianvalentim/LifeOS)：本地项目、活动和阅读的组织思路相关；产品范围与本项目不同，不作为依赖。
- [TagSpaces](https://github.com/tagspaces/tagspaces)：离线文件、标签与预览的边界有参考价值；AGPL/商业双许可和完整文件管理工程不适合作为阶段 0 必须依赖。
- [Karakeep](https://github.com/karakeep-app/karakeep)：收藏链接、笔记、图片和检索的分类可参考；自托管及 AI 自动标签方向超过当前需求，不接入其服务。

参考 [Node 24 SQLite 文档](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)。以后如借用开源代码，必须重新确认当时具体文件的许可证。

## 模块扩展

每阶段新增对应服务、仓储方法和 SQL 迁移，再接入页面。跨页面数据共用同一服务，不复制日志或收藏。当前不引入插件运行时。

- 阶段 1：项目字段扩展、分类、CRUD、状态/进度、详情及统计。
- 阶段 2：参与者、日志、里程碑和跟进草稿。
- 阶段 3：资料、分类、标签和收藏夹。
- 阶段 4：存储根目录、文件资产、回收站、备份恢复。
- 阶段 5：提醒规则与 Windows 通知，届时确认是否需要托盘或任务计划程序。
- 后续再做全局搜索、桌面封装和正式 UI 设计。

## 运行与安全边界

仅绑定 127.0.0.1，拒绝异常 Host；写设置要求同源 JSON，校验枚举。静态根仅 public，包含路径边界检查、CSP 和禁止 MIME 嗅探。服务日志追加保存，不打印请求正文。当前没有业务写接口和删除文件能力。

SQLite 启用外键、WAL、5 秒忙等待，迁移在事务内执行并记版本。迁移不覆盖已有表或用户数据。后续重要迁移前应先实现备份。

当前面向单用户本机使用，不提供跨设备访问或 Windows 后台服务。窗口关闭后的通知不属于本阶段承诺。

## 阶段 1 增量（2026-11-16）

继续保留原架构、页面外壳和主题，不新增第三方依赖。`server/projects.mjs` 封装业务校验及数据操作，`public/pages/projects.js` 管理列表/详情/分类页，`project-dialogs.js` 管理表单和确认，`ui/project-components.js` 统一进度、图标与时间显示，`styles/projects.css` 为增量样式。

使用 `#projects`、`#projects/:id`、`#projects/categories` 路由。筛选条件保存在 hash 的查询部分。写入成功后从 SQLite 重新读取 bootstrap，保证总览、列表和详情使用同一份项目数据；窗口重新获得焦点时刷新，编辑使用 revision 防止旧数据覆盖。界面可输入的文字全部转义，图标标识不作为 HTML 执行。

删除项目采用软删除，保留关联，未接入文件删除或回收站功能。分类转移与删除使用事务。阶段 2 的参与者、日志和时间线仅有说明性扩展区，没有编辑器、日志写入、模拟记录或提前建表。

开始变更前的源码/数据库快照保留于 `backups/before-phase1-20261116-201705.zip`。测试数据库与正式 data 目录隔离；正式库只执行增量迁移，不填入验收记录。


## 阶段 2 增量

v0.2.0，数据版本 003。server/development.mjs 封装参与者、日志、关联和备忘事务；public/pages/development.js 提供共享组件与交互，journal.js 转出跟进中心页面，项目详情复用同一模块。public/styles/development.css 延续现有主题变量，没有新增运行依赖。参与者管理位于 #journal/participants。

项目参与者与日志参与者独立多对多关联；日志与工作备忘独立持久化，不维护重复副本。删除保留历史，编辑有 revision 校验。当前读取方式仍为本地 bootstrap 集合，适用于个人规模；未来大数据量再做分页。保留本地浏览器架构和 Windows 一键启动；没有进入阶段 3。

## 阶段 3 增量

v0.3.0，数据版本 004；保留现有运行架构、主题、布局、数据，不安装依赖。server/library.mjs 负责资料及分类/标签/收藏夹、共享项目引用和事务；server/assets.mjs 单独处理流式上传、内容识别、本地读取、范围请求及下载。

public/pages/library.js 提供列表、详情、整理管理和项目详情关联区；library-dialogs.js 按资料类型生成表单；ui/library-components.js 统一类型/状态词表、选择控件及卡片；styles/library.css 使用已有主题变量。路由 #library、#library/:id、#library/manage。总览显示真实资料数量和最近修改资料。

上传在元数据保存后进行，使用独立二进制请求，不把大型文件转成 JSON 或写入 SQLite。文件最多 512 MiB，流式写临时文件并计算 SHA-256，内容复制完成后事务关联；同内容共享磁盘文件，元数据保持独立。上传错误保留已保存资料并提示补传，不伪装成全部成功。异常中断可能保留临时或未关联内容，后续清理属于阶段 4。

文件仅从配置数据根目录的 assets 读取，校验 managed 路径边界；图片/视频使用有限的格式识别，附件强制下载与 octet-stream，不执行用户上传代码。响应支持 HEAD、单段 Range 和流读取，视频可按需取片段。没有转码、远程抓取或外部媒体依赖。相同网址拒绝重复新增，优先编辑现有资料的关联。

资源与项目关联更改会更新受影响记录版本，避免两侧表单互相覆盖。软删除内容的底层关联继续保留；常规列表排除已删除记录。文件内容不随业务软删除、替换或解除项目引用而删除。外部存储目录 UI、引用模式、文件夹、批量导入、回收站和完整删除规则均未开发。

## 阶段 4 增量（v0.4.0）

保留原架构，新增 file-paths.mjs（路径边界、摘要和对象定位）、storage.mjs（存储目录、导入、文件操作、回收站、项目目录）、backups.mjs（SQLite 在线快照、校验、恢复）。005 为新增迁移；file_objects 是共享文件本体，旧 file_assets 仍保存资料历史资产，通过 file_id 指向本体。

前端 files.js / files.css 提供 #library/files、#library/trash、#settings/storage、#settings/backup，四个主导航不变。项目与资料详情复用文件模块。应用内本地选择器通过同源 POST 列出目录和文件，不向网页暴露任意文件内容；系统旧式 FolderBrowserDialog 在本机异常，因此不将它作为运行依赖。Windows Explorer 使用明确的可见窗口入口，不使用 shell 拼接命令。

API 操作串行，备份恢复与导入不互相交错。移动前写 disk_jobs 计划，同卷重命名；跨卷复制后核对摘要再更新登记，之后移除源副本。启动恢复已移动或已复制的计划；存在不确定双副本时只提示，不自动删除。路径操作限制在配置目录内，拒绝穿越、符号链接、目标覆盖；外部引用默认不改动源文件。

备份为自包含目录包，使用 node:sqlite backup 获取一致快照；逐文件摘要校验，数据库与外键完整性检查。托管项目目录额外扫描未登记文件纳入快照；普通外部目录不自动扫描。恢复先验证并在独立目录准备全部文件，再创建恢复前安全备份，关闭/替换/重开数据库，异常则退回原数据库。runtime.db 可更新，服务及后续请求使用新连接；备份中的未完成磁盘操作不在新环境自动执行。

修复导航时旧状态渲染后再次刷新清空用户输入的问题：路由读取成功后渲染一次，编辑表单/模态框中不因窗口聚焦而刷新。没有引入桌面壳或阶段 5 的后台提醒。

## 阶段 5 增量

v0.5.0 / 006。server/reminders.mjs 是唯一的到期、处理、通知预留与去重逻辑；HTTP 页面和 scripts/check-reminders.mjs 共用。项目的 last_followed_at 独立于普通 updated_at。前端 pages/reminders.js / styles/reminders.css 使用已有组件，#journal/reviews 与 #settings/reminders 保持四主导航结构，总览只显示真实待回访摘要。

server/windows-reminders.mjs 封装固定 PowerShell 脚本调用，参数以独立配置文件传入，不拼接 shell 命令。windows-reminders.ps1 注册当前用户 Limited / Interactive 的每日和登录任务及 AUMID 快捷方式/协议，WScript 隐藏启动单次 Node 检查器；不安装常驻服务，不保存密码。启动目录已知路径在当前环境可能为空，使用当前 APPDATA 作为回退，已实测。

通知以预留批次 + 逐对象 cycle/冷却记账，Windows 拒绝时记录失败并释放预留；进程在投递后崩溃的 pending 不立即重试，优先避免重复弹窗。SQLite BEGIN IMMEDIATE 负责跨进程竞争，data-lock 文件租约协调检查器和整库备份/恢复。检查器缺少数据库时拒绝建空库。

协议名称按数据路径摘要区分；打开脚本验证路由白名单、端口和数据库身份，必要时冷启动本机服务，再打开对应页面。stop.bat / scripts/stop.mjs 使用同源受保护停止接口并校验数据路径，区分后台本地服务与独立提醒任务。

备份版本从固定 005 改为当前迁移号；允许 005/006 校验恢复，通过共享迁移函数升级旧包。恢复之前关闭系统任务，候选库默认关闭 desktop_enabled，恢复后由用户重新安装，避免任务时刻和已恢复配置不匹配。


## 阶段 6 增量（v0.6.0 / 007）

继续使用 Node.js 24 + 原生 SQLite/HTTP + HTML/CSS/ES Modules，零新增运行依赖，保持四主导航、布局和主题。新增服务 usage.mjs、presets.mjs、search.mjs；新增页面 usage.js、presets.js、search.js、quick-actions.js 以及 experience.css。设置子路由 #settings/usage、#settings/presets；#search?q= 统一搜索；#journal/person-:id 显示参与者档案。

前端 services/usage.js 的 ActivityClock 使用 performance.now 计算实际时间，综合 visibilityState、hasFocus、用户输入/指针活动。10 分钟无活动暂停；15 秒心跳，单片段最多 30 秒，迟到最多接受最近两分钟，以保守方式处理休眠/冻结。服务端对 app / project:ID 区间分别合并并用收据幂等去重，避免多窗口叠加。统计仅写 usage_*，不触碰项目 revision、updated_at、last_followed_at 或开发日志。访问 ID 在进入项目时建立，同项目重渲染沿用；离开再进入建立新访问。

预设是录入模板，统一 kind/name/icon/subtype/order/image/revision 管理；默认目录和初始值在 007 SQL 数据中登记。用户选用后创建/填写独立业务记录，并保存图标/图片快照；业务不依赖预设 ID。删除模板不级联历史，恢复仅补缺名称。图片保存在文件系统，file_objects 登记并纳入现有移动、路径、回收站和完整备份校验；file-paths.usage 同时报告图标引用，避免无提示删图。

全局搜索使用参数化 SQLite LIKE、字面转义通配符，按类型限 50 项，适合目前个人本地数据规模；没有引入搜索服务或外部依赖。未来大量内容可局部换 FTS。搜索日志带 ?log=ID，在详情展开、突出并滚动定位；分类和标签进入已有过滤列表。最近活动由真实业务 updated_at 汇总，不把使用统计混入。

备份支持 005/006/007，旧包先迁移再恢复；新的统计表、预设和图片随完整快照持久化。原 Windows 提醒链路继续使用同一规则服务，本阶段不安装或更改系统任务。


## 阶段 7 · 前端设计层

v0.7.0 不改变后端、迁移或 API。tokens.css 提供 pd-* 语义体系与旧 token 适配，studio.css 收口外壳/页面/控件；ui/day-night.js 从用户 HTML 移植 Canvas/交互并限制作用域，ui/studio.js 负责主题桥接、命令与页面组织，project-card.js 共享真实项目卡片。preferences.js 按 databasePath 分区浏览器界面偏好；主题继续使用原 settings 接口。七主要页面在原 routes / bind / refresh 体系中增量调整，业务写入与统计完全沿用原逻辑。详细交互契约见 UI_DESIGN_SYSTEM.md。
