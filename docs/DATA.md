# Data and File Organisation

## v1.0.0 / Phase 8.2 current notes

The business schema remains **007**, with 34 business/migration tables; existing SQL migrations were not rewritten. The data descriptions below are preserved per introduction phase.

- `.restore-state.json` is written before a database switch: version, previous/staged file names and their SHA-256. The primary database is only moved after fsync completes. The marker is checked before opening the primary database, verifying digest, SQLite integrity, foreign keys and `schema_migrations`; continuation only happens when recovery is clearly possible, and an unknown state refuses to create or overwrite a database. The marker is removed after confirmation and the safety backup is kept. If a legacy installation has no marker but has restore leftovers and no primary database, creating an empty database is refused — keep the evidence and confirm manually.
- `.reminder-data-mutex.sqlite` is an independent runtime mutual-exclusion file using a SQLite exclusive transaction, not a second business database. Closing/exiting releases the OS lock; full-database application backups neither pack it nor depend on it to restore business records. The legacy `.reminder-data.lock` still records PID/token; an empty lock has a 2-second initialisation guard, and taken-over leftover metadata is renamed `.abandoned-*` for diagnosis. A surviving legacy holder is still awaited, and a crashed holder's business operations are never replayed automatically.
- `payload` of folder recycle records gains an optional `project_ids` field recording only the project ownership at recycle time. When restoring to another location, projects and file registrations still pointing at the original path are updated in the same transaction; newly added users of the old location are not rewritten. Older payloads without the field are derived compatibly from the original path prefix, requiring no migration.
- Before reusing a deduplicated file, the current on-disk digest/size is checked; on detecting an external rewrite, `file_objects` sha256/size/mime/revision are updated before deciding whether it is genuinely a duplicate, without touching development logs or the actual follow-up timestamps.
- `/api/health.version` and `/api/bootstrap.storage.appVersion` come from package.json; the business `schemaVersion` remains 007. The version number is not the database migration number.

The production SQLite/WAL/SHM fingerprint in this phase matches the pre-change state; the production database was not connected. The integrity check of a new copy was not completed due to directory creation permissions; isolated automated tests for integrity/foreign keys and backup/restore pass, but they do not substitute for a fresh integrity check of the current production database. See `PHASE82_REPORT.md`.

Database: `data/project-desk.sqlite`, SQLite STRICT tables. Identifiers are TEXT, generated as UUIDs by the service. Timestamps are ISO 8601, stored in UTC and displayed in the local time zone.

| Table | Fields / responsibility (phase increments below) |
| --- | --- |
| schema_migrations | Migration file name, execution time; engineering metadata only |
| settings | key/value; currently only theme, default system (no row needed when unset) |
| projects | id, name, description, status, 0–100 integer progress, folder path, created/updated time, category_id, archived_at, deleted_at, revision |
| project_categories | id, name, icon, favourite, sort_order, revision, created/updated time |
| journal_entries | id, project_id, content, occurred/created/updated time |
| resources | Material metadata, kind/URL/body, category, status/favourite, timestamps, soft delete, revision and current asset reference |
| project_resources | Many-to-many association between projects and materials |
| file_assets | Material association, storage mode, content-relative path, original file name, MIME, size, digest, created time |

Status and progress are independent; progress never changes status automatically. Project statuses are not_started/in_progress/paused/completed/abandoned. Foreign-key deletion uses RESTRICT to avoid accidental cascades; later business deletions must handle associations explicitly inside transactions.

Phase 1 added `002-project-archive.sql` while `001-foundation.sql` stayed unchanged; existing projects default to uncategorised, unarchived and undeleted with revision=1. Tags/collections, participants, reminders, material status and covers continue to be implemented through new migrations in their own phases:

- A category is a single primary grouping scoped per project/material; tags allow multiple selection; a collection is a user-organised set. All three have separate tables.
- `journal_entries` is the shared data source for project detail and the follow-up centre; drafts get their own table.
- One material can be associated with multiple projects; file assets distinguish managed copies from external references. Unlinking a record never deletes the real file.
- Managed files are currently organised under `assets` in the data root by content digest; external storage selection and reference mode are deferred to Phase 4. Source code, database and large files stay separate.
- Phases 2 and 3 add 003 and 004 respectively; executed migrations must never be rewritten.

## Phase 1 data rules

- A project has at most one primary category; NULL means "uncategorised". Category names are trimmed, non-empty and at most 40 characters, with a SQLite NOCASE index preventing duplicates (ASCII case-insensitive). The number of categories is unlimited.
- Category icons are built-in keys (folder/code/design/book/camera/globe/idea) or custom symbols. The UI limits custom symbols to 4 characters while the server allows up to 24 characters for generic icon identifiers; HTML/SVG code is neither accepted nor executed.
- `favorite` only controls quick-entry visibility and `sort_order` only controls ordering; neither changes a project's category or status. Move-up/move-down reordering updates the full category sequence inside a transaction.
- Project names are 1–120 characters, descriptions at most 5000 characters, and progress must be an integer from 0 to 100. Status, progress, category and archive state never derive from each other. Timestamps are generated server-side as UTC ISO values and displayed in the local time zone.
- `archived_at` is the archive time or NULL; restoring only clears the archive marker. Edits, archive/restore and category transfers update `updated_at` while `created_at` stays fixed.
- `deleted_at` is a soft-delete marker. Deletion only marks the row and deletes neither the original data nor files; ordinary lists, details, category counts and the Dashboard exclude deleted rows. No soft-delete restore endpoint or UI exists yet.
- Category deletion transfers all references inside a `BEGIN IMMEDIATE` transaction (including archived and soft-deleted rows) before deleting the category; an invalid target rolls back entirely. Transferring to NULL means uncategorised.
- `revision` is a monotonically increasing version. Project updates/archive/delete and category edits require the client's current revision, using conditional updates to prevent stale windows from overwriting newer data. Category transfers also bump the revision of affected projects.
- Dashboard totals and the five status counts include archived projects and exclude deleted ones, with a separate archived count. Recent projects are ordered by update time descending, at most 5 items.

## Phase 1 HTTP endpoints (historical scope)

Apart from Phase 3 file uploads and the material metadata limit below, writes require a same-origin Origin and `application/json`, with a 32 KiB body limit; invalid input returns 400, not found 404, and version conflicts/duplicate category names 409.

| Endpoint | Responsibility |
| --- | --- |
| GET /api/bootstrap | Settings, storage version 002, project statistics, all visible projects and categories |
| GET /api/projects | q/category/status/archive/sort/order filtering and sorting; archive=active/archived/all, default active |
| POST /api/projects | Create a project |
| GET /api/projects/:id | Read detail |
| PUT /api/projects/:id | Update name/description/status/progress/category with revision |
| PUT /api/projects/:id/archive | archived boolean and revision |
| DELETE /api/projects/:id | Soft delete with revision |
| GET/POST /api/categories | List/add project categories |
| PUT /api/categories/:id | Edit name/icon/favourite with revision |
| PUT /api/categories/reorder | Full ordered ids array |
| DELETE /api/categories/:id | replacement_id (category ID or null) and revision |
| PUT /api/settings | Existing theme endpoint |

The browser reads the project collection from bootstrap and performs filtering and 30-per-page display locally; there is no server-side pagination, which suits personal-scale data. Server-side pagination and lightweight queries can be added when volumes grow, without changing the SQLite data source. This describes Phase 1 reading only; Phase 2/3 endpoints are below.

## Phase 2: 003-development.sql

Keeps 001, 002 and existing project/log content, and adds:

| Table | Responsibility |
| --- | --- |
| participants | Custom name/type/role, revision, created/updated time, deleted_at |
| project_participants | Composite primary key (project_id + participant_id); the project's overall participant list |
| journal_participants | Composite primary key (journal_id + participant_id); actual participants of a single log |
| project_workspaces | One row per project: current_work/problems/ideas/next_step, revision, updated_at |

`journal_entries` gains title/files/result/problems/next_step/notes, important, revision and deleted_at. Existing content, occurred_at and created/updated times are unchanged. Titles are at most 200 characters, other text at most 5000, and either content or title must be present; title-only entries store the title as content. Participant names are 80 characters and types 40, with no preset brands or types. The body limit stays 32 KiB, and oversized forms show an error while preserving input.

The project's overall list and each log's list are stored separately. Saving a log writes the log and its participant links in a transaction and adds new participants to the overall list; removing a project participant still referenced by an undeleted log returns 409. Deleting a log does not clear participants the project has used. Participant deletion is soft and historical references remain; editing an old log may keep its already-deleted participants but cannot add deleted ones. Name/type edits propagate to historical associations — no per-rename snapshots are kept.

All development writes use transactions with revision conflict checks; a work memo's first save uses revision=0 and later saves carry the current version. Log/memo/association changes update the project's `updated_at` and revision without changing status, progress, category or archive state. Soft-deleting a project does not erase its history, but global reads and statistics exclude that project's content.

New endpoints: GET/POST /api/participants, PUT/DELETE /api/participants/:id; GET/POST /api/journals, PUT/DELETE /api/journals/:id; PUT /api/projects/:id/participants; PUT /api/projects/:id/workspace. Writes still require same-origin JSON. Bootstrap adds participants (including historically deleted ones), memberships, journals (with participant_ids) and workspaces; data version 003. All pages read the same dataset and timeline filtering runs in the browser without log pagination.

Phase 2 completed with the next migration starting at 004; executed migrations must not be rewritten. Dates are stored in UTC and the UI and date filters use the local time zone. Memos are never written into `journal_entries`. Phase 2 has no attachments, media files or library writes; those arrive with Phase 3 below.

## Phase 3: 004-library.sql (current)

Does not modify 001–003; SQLite continues to store metadata and media files never enter BLOBs.

| Table | New content / responsibility |
| --- | --- |
| resources | category_id, platform, notes, status, favourite, last_viewed_at, deleted_at, revision, asset_id; keeps title/kind/source_url/content/created_at/updated_at |
| resource_categories | id/name/icon/sort_order/revision/created_at/updated_at; single primary category |
| resource_tags | Same fields; multi-select feature labels in their own namespace |
| resource_collections | Same fields; multi-select thematic sets in their own namespace |
| resource_tag_links | Composite primary key (resource_id + tag_id) |
| resource_collection_links | Composite primary key (resource_id + collection_id) |
| project_resources | Keeps project_id + resource_id; materials shared across projects |
| file_assets | Adds original_name, mime, size, sha256; keeps material association, storage mode, relative path and created time |

`kind` is video_link/image/web/text/file/video; `status` is unsorted/to_view/learning/learned/used/archived. Favourite, status, category, tags, collections and project status are all independent. Favourite time uses `created_at` and never changes on edit; `last_viewed_at` updates when viewing detail, opening a URL or downloading, without bumping revision or changing `updated_at` or learning status. Favouriting does not determine whether a material is stored.

Titles are 1–160 characters, text bodies at most 30000, notes/purpose at most 5000, and source platform at most 100 (free text, no preset platform table). Text materials require a body; URLs accept only http/https and are stored normalised, with exact duplicates among non-deleted records rejected in favour of reusing the existing material. A material allows at most 200 associations of each kind. Category/tag/collection names are 1–40 characters with per-table NOCASE uniqueness; icons are 1–24 characters and never executed as HTML.

Category deletion first transfers all references inside a transaction (including soft-deleted materials) to another category or NULL; deleting a tag/collection only removes the links and keeps the material itself. Soft-deleting a material keeps all underlying historical associations, hiding them on read. Editing a material keeps associations to soft-deleted projects; editing project associations keeps associations to soft-deleted materials. Association changes update the relevant versions and timestamps, and stale forms receive 409.

Files default to `data/assets/<SHA-256>` (or `PROJECT_DESK_DATA_DIR/assets`), with `file_assets.path` storing `assets/<digest>`; user input never determines the path and the file name is download metadata only. Only managed copy mode exists at this stage. Every upload creates a new asset row and `resources.asset_id` points at the current asset; identical bytes share the content file and old assets are retained. A material can exist as a "no file" record before upload, and failed uploads can be retried. Uploads never move or modify the source file.

Single files are capped at 512 MiB and empty files rejected. PNG/JPEG/GIF/WebP images and MP4/WebM/Ogg video containers are detected; internal codec playability is not guaranteed. Other attachments are always `application/octet-stream` and download. Reads are restricted to managed directories, exposing only the current asset of an undeleted material, supporting GET/HEAD and single-part Range; a missing file returns 404 and the UI can re-upload. Temporary upload files are normally cleaned in `finally`; abnormal process termination and concurrent conflicts may leave files behind, which this phase does not clean automatically.

### Phase 3 HTTP endpoints

| Endpoint | Responsibility |
| --- | --- |
| GET /api/resources, GET /api/resources/:id | Visible materials with relation arrays and current file description |
| POST /api/resources, PUT /api/resources/:id | Create/edit metadata; edit carries revision |
| DELETE /api/resources/:id | Revision-checked soft delete, keeping disk content |
| POST /api/resources/:id/view | Update last viewed time |
| PUT /api/resources/:id/favorite | favourite boolean and revision |
| GET/POST /api/library/{categories,tags,collections} | Read/add organisation objects |
| PUT/DELETE /api/library/{type}/:id | Revision-checked edit/delete; category deletion needs replacement_id |
| PUT /api/library/{type}/reorder | Full ordered ids array |
| PUT /api/projects/:id/resources | resource_ids and project revision, changing that project's references |
| POST /api/resources/:id/file?revision=N | Same-origin octet-stream binary; X-File-Name is the URL-encoded original name |
| GET/HEAD /api/assets/:assetId | Read the current asset; ?download forces download |

Material JSON is capped at 256 KiB to accommodate a 30000-character Chinese body; other JSON endpoints stay at 32 KiB. Uploads bypass the JSON reader. Writes still require a same-origin Origin, and uploads additionally require exactly `application/octet-stream`. Invalid input 400, bad origin 403, not found 404, version/duplicate name/duplicate URL conflicts 409, oversize 413, invalid range 416.

Bootstrap data version is 004 with resources (including tag_ids/collection_ids/project_ids), libraryCategories, libraryTags and libraryCollections. `summary.resources` excludes soft-deleted rows. The frontend reads from the same bootstrap and filters 30 per page; there is no server-side paged query or full-text index yet, which can be optimised later at personal scale without maintaining copies.

Further migrations start at 005. Phase 4 handles external storage settings, reference mode, folders, batch import, full deletion and restore policy; this phase never auto-cleans old assets or disk files.

## Phase 4: 005-files.sql (current)

Legacy fields are neither dropped nor rewritten; new tables and links:

| Table | Responsibility |
| --- | --- |
| storage_roots | id/name/role/path/revision/created_at; image/video/file/project/other roles, with `@data/` resolving to the current data directory |
| file_objects | File body: root_id/path/storage_mode/name/mime/size/sha256/revision/created_at/deleted_at/trash_path/purged_at |
| file_assets.file_id | Points at the shared body; legacy path/original name are kept for compatibility, and reads use the body |
| storage_folders | Tool-registered folders, composite primary key (root_id + path) |
| file_trash | original_path/stored_path of the file or directory, restore manifest for objects/subdirectories, deletion time; external references only record the reference relationship |
| disk_jobs | Persisted move plans, state and errors, used for interruption recovery and duplicate-copy warnings |

005 merges existing assets into bodies by storage mode and path without moving old bytes. Managed paths are relative to `storage_roots`; reference paths are absolute. Materials still point to assets via `resources.asset_id`, and multiple materials can share a body; projects share materials through the existing `project_resources`.

Material soft delete continues to use `resources.deleted_at` and can be restored from the recycle bin. Permanently deleting a material row removes associations and historical asset registrations, while `file_objects` and the real file remain. File recycling is governed by the body's `deleted_at`/`trash_path` plus `file_trash`, affecting all sharing materials. Permanent purge only deletes bytes inside the managed recycle path, marking `purged_at`; external references never delete source files. This recycle bin is independent of the Windows Recycle Bin.

Copying either selects a directory automatically by type or takes an explicit root and subdirectory; identical content reuses an existing usable material, keeping its status/category and merging new project references. Browser uploads remain at 512 MiB; path copy/reference streams the digest instead of using the JSON large-file channel. A batch holds at most 200 files and reports success/duplicate/error per item without rolling back already-successful items. Same-name different-file collisions are avoided automatically.

Directory migration requires an empty target; file and directory moves update the body and the corresponding project folder/reference. Relink verifies the digest by default and requires explicit `allow_changed` confirmation on mismatch. A reference inside a configured root can be re-registered as managed without copying or deleting the old location. Plain external references get no rename, move or delete buttons.

New endpoints: GET /api/filesystem, GET /api/trash; POST /api/filesystem/{choose-list,browse,folder,move,trash,import,reveal,upload}; POST/PUT/DELETE /api/storage-roots[/:id]; PUT /api/files/:id/relink; PUT /api/projects/:id/folder; POST /api/trash/:id/{restore,purge}; POST /api/trash/empty; POST /api/backups/{create,inspect,restore}. All keep host and same-origin write protection, and the picker also requires same-origin POST. `upload` uses octet-stream, the rest JSON.

Bootstrap is 005 and adds `fileSystem` (roots, files, availability, usage scope, project folders and pending jobs); resources gain file_id/actual mode/file-recycle markers. Paths and sizes come from file bodies, never from browser temporary storage.

The backup manifest records `format=project-desk-backup`, `version=1`, `schema=005`, database digest/size, root mapping, file list/digests, missing files and external reference paths. Blobs are deduplicated by content digest; managed recycled files and historical assets are included. Restore relocates `storage_roots` and managed project folders while keeping external paths. Pre-restore snapshots live in `data/recovery`; directories from before and after the database switch are both kept to avoid overwriting original files. Backups are not encrypted, and restore accepts only integrity-verified packages of the same version.

Further migrations start at 006; Phase 5 reminder rules do not exist yet.

## Phase 5: 006-reminders.sql (current)

Adds `projects.last_followed_at` without changing the semantics of the ordinary project update time.

| Table | Responsibility |
| --- | --- |
| reminder_settings | Single row: global, project and material switches, project_days/resource_days/repeat_days/snooze_days, daily_time, revision |
| reminder_rules | Primary key kind=project/resource/category + entity_id; nullable inherited cycle, repeat interval, paused, snooze deadline, handled time, revision |
| reminder_history | Object type/ID, title at the time, action, UTC timestamp and description; the UI shows the latest 300 |
| reminder_deliveries | Notification batch id, created_at, pending/sent/failed, object snapshot, error and completion time |
| reminder_notified | kind/entity_id current cycle, last reservation/delivery time, delivery_id; prevents duplicates and drives cooldown |
| reminder_runtime | desktop_enabled/desktop_port/last_check_at and other runtime metadata; actual system task state must be queried from Windows |

A project's anchor is the latest of creation, `last_followed_at`, an effective log event/actual save, and a non-empty memo; the ordinary project `updated_at` does not participate. A material's anchor is the later of `created_at`/`last_viewed_at`. Base due = anchor + cycle; the effective due is the maximum of base due, `handled_at` + repeat interval, and `snoozed_until`. Cycles use 24 hours, while display and date filtering follow local time. Future event times never retroactively mark something as followed up.

A single-object cycle overrides the category, which overrides the global setting; inheriting a category cycle also inherits the category pause. Only in-progress, unarchived projects participate by default; materials marked learned/used/archived do not. Rules, project status, progress and favourite flags are mutually independent. Actions run in transactions and verify data and rule revisions. "Go view" only updates `last_viewed_at` and the handling history; "continue following" only updates the independent actual follow-up time; archiving, learning, using and deleting require explicit actions and never delete bytes.

The same due cycle does not notify again within the repeat interval. On Windows failure the batch reservation is released so the next check can retry; `pending` keeps the reservation to avoid uncertain re-delivery after a crash. `sent` means the OS accepted the notification, not that the user read it or learned the material. Multiple items are consolidated into one notification, and tags and group names let an older summary be replaced, so no per-object task is created.

New endpoints: GET /api/reminders; PUT /api/reminders/settings and /rule; POST /api/reminders/action; POST /api/reminders/windows/{install,status,test,run,uninstall}. Bootstrap adds `reminders`; data version 006. The shutdown endpoint POST /api/shutdown is only exposed while a service is actually running and still requires a local Host, same-origin JSON and an explicit confirmation field, used by `stop.bat`.

Windows tasks and protocols are operating-system resources and are not registered automatically from a SQLite backup. A 005 package is upgraded to 006 before restore; 006 tables are included in backups. Restore closes current tasks and sets the candidate database to `desktop_enabled=0` for explicit reinstallation afterwards. Windows configuration and diagnostic logs under `data/reminders` are local helper files, while core rules/state/history remain in SQLite.

The next migration starts at 007; Phase 6 is not started.

## Phase 6: statistics and presets (007-experience.sql)

Old tables are not rebuilt; the following independent data is appended:

| Table/field | Responsibility |
| --- | --- |
| usage_sessions | Page session ID, first load/latest valid activity/end in epoch milliseconds; launch count equals loads |
| usage_visits | Project visit ID, session, project foreign key and open time; re-renders within one visit do not add rows |
| usage_blocks | Merged valid time intervals with scope=app or project:ID, start/end as UTC epoch milliseconds |
| usage_receipts | Client slice ID deduplication; receipts kept two days while historical intervals are kept long-term |
| preset_defaults | 17 initial default metadata rows: 6 project categories, 6 participants, 5 platforms, the basis for "restore defaults" |
| presets | kind, name, icon, participant type, order, default origin, image file ID, revision and timestamps; per-group NOCASE uniqueness |
| project_categories.icon_file_id | Image reference copied at selection time, never a template ID |
| participants.icon / icon_file_id | Participant's own icon and image; legacy rows default to `idea` |
| resources.platform_icon / platform_image_id | The material's own platform icon and image; deleting a platform preset does not affect history |
| storage_roots: preset-images | Defaults to `@data/preset-images`, independent of business materials, creating no fictitious resource rows |

Defaults are preset data only and never auto-generate business categories, participants or materials. Restore defaults only fills missing names; existing rows, edited content, user ordering and custom entries are preserved. If an original name was renamed, the renamed entry stays and restore adds the original default name back. Images are not deleted with presets, and historical references feed file-usage warnings and backups. Names and icons are escaped on display and uploaded SVG/HTML is never executed.

All statistics are stored independently and never update projects or logs. The server merges overlapping intervals rather than summing them, so client batches can be retried safely; soft-deleting a project does not erase historical statistics. Daily statistics use the local time zone offset, with today/7 days/30 days including today; no history shows 0 or "none yet". Average per session = merged valid time ÷ the corresponding load/visit count, including in-progress sessions. The practical limit of the final heartbeat on a hard exit is described in the README.

Main new endpoints: POST /api/usage/heartbeat; GET /api/usage?offset= and /api/usage/projects/:id?offset=; GET /api/search?q=; GET/POST/PUT/DELETE /api/presets[/:id], POST /:id/apply, POST/DELETE /:id/image, PUT /reorder, POST /restore. GET/HEAD /api/preset-images/:fileId serves only safe images still referenced by presets or historical business records. Writes keep same-origin validation; preset images are capped at 2 MiB while other uploads remain at 512 MiB.

Backup verification now accepts 005/006/007; the full SQLite snapshot automatically includes statistics and presets, and all managed images are digest-verified through `file_objects`, with older packages migrated to the new tables. The production data upgrade was compared item by item against the 28 tables and original fields/rows from before the change.

## Phase 7 data boundaries

v0.7.0 is a design phase: data version stays 007 with no new tables, fields or migrations, and backend files are completely unchanged. The theme is still stored in `settings.theme` in SQLite. View mode, per-project pinning and recent-item count are frontend preferences stored in `localStorage` partitioned by actual database path; they never write projects or logs, never change `updated_at` / revision / idle anchors, and are not included in existing SQLite backups. Changing browsers or clearing site data restores UI defaults without losing business data. No priority, task or development-stage model was created, and no task counts were fabricated.
