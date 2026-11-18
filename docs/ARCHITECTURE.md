# Phase 0 Architecture Decisions

> Current version v1.0.0; Phase 8.2 fixes complete, awaiting final acceptance. The phase decisions below are preserved as historical record; current capabilities should be read together with later increments and the README. Statements such as "search disabled" in Phase 0 are not current limitations.

## Phase 8.2 Reliability Fixes

Continues with Node.js 24 + native ES Modules / HTML / CSS + built-in SQLite and a local HTTP server; no third-party runtime dependencies, no new business tables or migrations.

- `assets.mjs` ends zero-byte responses immediately; the HTTP error handler distinguishes `headersSent` to avoid sending a response twice.
- `restore-state.mjs` persists the switch marker and a chunked digest before the database is renamed, and `openDatabase` restores an explicitly matching state before creating or connecting. Unrecognised leftovers from older versions refuse to create an empty database. Full restore still delegates file verification, directory remapping and the safety backup to `backups.mjs`.
- `storage.mjs` keeps the original disk job/transaction plan and adds the original project path relationship when a trash directory is relocated; candidate files are actually read before deduplication, stale candidates are not reused, and other files at the original location are never overwritten.
- `data-lock.mjs` uses an independent SQLite exclusive transaction as a cross-process lock, avoiding permanent blocking on an empty JSON lock file; the legacy PID lock remains compatible and diagnostic metadata is retained. Runtime mutual exclusion is independent of business database switching.
- `launch.mjs` verifies the health version and bootstrap database path before reusing a running service, and never shuts down other workspaces. `version.mjs` reads the current version from package.json so health and bootstrap responses share one source.
- `studio.js` syncs the form when theme saving succeeds or fails, and preserves drafts when the system appearance changes; the original Canvas and CSS are untouched.

Verification, permission constraints and retained evidence are in `PHASE82_REPORT.md`. This phase is not a new full audit and does not change Windows tasks or the notification protocol.

Date: 2026-11-16. Scope: architecture and foundation.

## Choice

Use the HTTP, file system and SQLite capabilities already present in Node.js 24.x, with native ES Modules, HTML and CSS. There are zero third-party runtime dependencies and no build step. Native modules are sufficient for Phase 0; no desktop shell, cloud service, AI API or complex state framework is introduced ahead of need.

Interface, HTTP service and data layer are separated: `pages` handles pages, `ui` handles presentation, `services` handles requests, and `server` handles data and future file operations. When page complexity later justifies it, a mature component framework can be adopted locally without changing the persistence structure or the service interface.

Node's built-in SQLite interface is still under active development, so 24.x is pinned explicitly and all calls are wrapped in `database.mjs`. A future driver change will not affect pages. SQLite is an on-disk database; `localStorage` is not used for business data.

The product outline requires a sidebar and a top toolbar, so the top bar is retained; search was explicitly disabled and marked for later. The base visual used the neutral ratios of "Achromatic ledger" (seed 1215761365), keeping Windows system fonts and neutral greys to avoid locking in a strong style before the final visual direction was settled. Product identity comes from the folder mark and the workbench sections "record projects, keep materials, track history, review periodically". No external fonts, images, remote CDNs or sample data.

## Open-source reference evaluation

Only functional structure was referenced; no repository code was copied or introduced.

- [Personal OS](https://github.com/im4aLL/personal-os): useful direction for personal productivity tooling; repository information was insufficient to serve as a stable foundation, so the full engineering stack was not adopted.
- [LifeOS](https://github.com/adrianvalentim/LifeOS): relevant ideas for organising local projects, activity and reading; product scope differs from this project and it is not a dependency.
- [TagSpaces](https://github.com/tagspaces/tagspaces): valuable reference for offline files, tags and preview boundaries; its AGPL/commercial dual licensing and full file-management engineering were unsuitable as a Phase 0 hard dependency.
- [Karakeep](https://github.com/karakeep-app/karakeep): useful categorisation of saved links, notes, images and retrieval; self-hosting and AI auto-tagging exceed current needs, so its services are not integrated.

Referenced the [Node 24 SQLite documentation](https://nodejs.org/docs/latest-v24.x/api/sqlite.html). Any future reuse of open-source code must re-verify the licence of the specific files at that time.

## Module expansion

Each phase adds the corresponding service, repository methods and SQL migration, then wires up pages. Cross-page data shares one service; logs and favourites are never duplicated. No plugin runtime is introduced.

- Phase 1: project field expansion, categories, CRUD, status/progress, detail view and statistics.
- Phase 2: participants, logs, milestones and follow-up drafts.
- Phase 3: materials, categories, tags and collections.
- Phase 4: storage roots, file assets, recycle bin, backup and restore.
- Phase 5: reminder rules and Windows notifications, confirming whether a tray icon or Task Scheduler is needed.
- Later: global search, desktop packaging and formal UI design.

## Runtime and security boundaries

Binds to 127.0.0.1 only and rejects unexpected Host headers; settings writes require same-origin JSON and enum validation. The static root is `public` only, with path boundary checks, CSP and MIME sniffing disabled. Service logs are append-only and never print request bodies. There are no business write endpoints or file-deletion capabilities at this stage.

SQLite enables foreign keys, WAL and a 5-second busy timeout; migrations run inside a transaction and record their version. Migrations never overwrite existing tables or user data. Backup must be implemented before any significant migration.

Currently scoped to single-user, single-machine use; no cross-device access or Windows background service. Notifications while the window is closed are not promised by this phase.

## Phase 1 increment (2026-11-16)

The original architecture, page shell and theme are retained; no new third-party dependencies. `server/projects.mjs` encapsulates business validation and data operations, `public/pages/projects.js` manages the list/detail/category pages, `project-dialogs.js` manages forms and confirmations, `ui/project-components.js` unifies progress, icon and time display, and `styles/projects.css` holds incremental styles.

Routes are `#projects`, `#projects/:id` and `#projects/categories`. Filter state is kept in the hash query string. After a successful write, bootstrap data is re-read from SQLite so the overview, list and detail views share one project dataset; the view refreshes when the window regains focus, and edits use a revision check to prevent stale forms from overwriting newer data. All user-entered text is escaped, and icon identifiers are never executed as HTML.

Project deletion is a soft delete that preserves associations; file deletion and the recycle bin are not connected. Category transfer and deletion run inside a transaction. Phase 2 sections for participants, logs and timelines contain explanatory placeholders only — no editor, no log writes, no mock records and no tables created ahead of time.

Source/database snapshots taken before changes are kept in `backups/before-phase1-20261116-201705.zip`. The test database is isolated from the production `data` directory; the production database only runs incremental migrations and is never seeded with acceptance records.

## Phase 2 increment

v0.2.0, data version 003. `server/development.mjs` encapsulates participant, log, association and memo transactions; `public/pages/development.js` provides shared components and interactions, `journal.js` renders the follow-up centre page, and project detail reuses the same module. `public/styles/development.css` extends existing theme variables with no new runtime dependencies. Participant management lives at `#journal/participants`.

Project participants and log participants are independent many-to-many associations; logs and work memos are persisted independently without duplicated copies. Deletion preserves history, and edits are revision-checked. Reads still use the local bootstrap collection, which suits personal scale; pagination can be added when data volumes grow. The local-browser architecture and one-click Windows launch are retained; Phase 3 was not started.

## Phase 3 increment

v0.3.0, data version 004; existing runtime architecture, theme, layout and data are retained and no dependencies are installed. `server/library.mjs` handles materials plus categories/tags/collections, shared project references and transactions; `server/assets.mjs` separately handles streaming upload, content detection, local reads, range requests and downloads.

`public/pages/library.js` provides the list, detail, organisation management and project-detail association area; `library-dialogs.js` builds forms per material type; `ui/library-components.js` unifies the type/status vocabulary, pickers and cards; `styles/library.css` uses existing theme variables. Routes are `#library`, `#library/:id` and `#library/manage`. The overview shows real material counts and recently modified materials.

Uploads happen after metadata is saved, using a separate binary request so large files are never converted to JSON or written into SQLite. Files are capped at 512 MiB, streamed to a temporary file with SHA-256 computed on the fly, and associated transactionally once the content copy completes. Identical content shares one on-disk file while metadata stays independent. Upload failures keep the saved material and prompt for re-upload instead of pretending full success. Aborted uploads may leave temporary or unlinked content; cleanup is deferred to Phase 4.

Files are served only from the `assets` directory under the configured data root, with managed-path boundary validation; images and videos use limited format detection, attachments are forced to download as `octet-stream`, and user-uploaded code is never executed. Responses support HEAD, single-part Range and streaming reads, so video can be fetched in segments. No transcoding, remote fetching or external media dependencies. Duplicate identical URLs are rejected in favour of editing the existing material's associations.

Association changes between materials and projects bump the affected record versions so forms on either side cannot overwrite each other. Underlying associations of soft-deleted content are retained; ordinary lists exclude deleted records. File content is never deleted by business soft delete, replacement or unlinking. The external storage directory UI, reference mode, folders, batch import, recycle bin and full deletion rules are not developed at this stage.

## Phase 4 increment (v0.4.0)

The original architecture is retained; new modules are `file-paths.mjs` (path boundaries, digests, object location), `storage.mjs` (storage directories, import, file operations, recycle bin, project folders) and `backups.mjs` (online SQLite snapshot, verification, restore). Migration 005 is new; `file_objects` is the shared file body, while the legacy `file_assets` still stores material-specific historical assets and points to the body via `file_id`.

The frontend `files.js` / `files.css` provide `#library/files`, `#library/trash`, `#settings/storage` and `#settings/backup` while the four main navigation entries stay unchanged. Project and material detail views reuse the file modules. The in-app local picker lists directories and files through a same-origin POST without exposing arbitrary file contents to the page; the legacy system `FolderBrowserDialog` misbehaves on this machine, so it is not a runtime dependency. Windows Explorer is opened through an explicit visible-window entry point rather than shell command concatenation.

API operations are serialised so backup/restore and import do not interleave. Before a move, a `disk_jobs` plan is written; same-volume moves use rename, cross-volume moves copy, verify the digest, update the registration and then remove the source copy. On start, already-moved or already-copied plans are reconciled; when two copies exist and the state is uncertain the app only warns and never auto-deletes. Path operations are restricted to configured directories and reject traversal, symlinks and destination overwrites; external references never modify source files by default.

Backups are self-contained directory packages using `node:sqlite backup` for a consistent snapshot, with per-file digest verification plus database and foreign-key integrity checks. Managed project directories are additionally scanned for unregistered files and included in the snapshot; ordinary external directories are not auto-scanned. Restore verifies first, stages all files in a separate directory, creates a pre-restore safety backup, then closes, replaces and reopens the database, falling back to the original on error. `runtime.db` is updatable so the service and later requests use the new connection; unfinished disk jobs from the backup are not replayed in the new environment.

Fixed a navigation bug where stale state was rendered and then cleared user input on refresh: routes render once after a successful read, and edit forms/modals are not refreshed on window focus. No desktop shell or Phase 5 background reminders were introduced.

## Phase 5 increment

v0.5.0 / 006. `server/reminders.mjs` is the single source of truth for due calculation, handling, notification reservation and deduplication; HTTP pages and `scripts/check-reminders.mjs` share it. A project's `last_followed_at` is independent of the ordinary `updated_at`. The frontend `pages/reminders.js` / `styles/reminders.css` reuse existing components, `#journal/reviews` and `#settings/reminders` keep the four-entry navigation, and the overview only shows real pending-review summaries.

`server/windows-reminders.mjs` wraps invocations of a fixed PowerShell script with arguments passed through a separate configuration file rather than shell command concatenation. `windows-reminders.ps1` registers daily and logon tasks for the current user at Limited / Interactive level, plus an AUMID shortcut/protocol; WScript launches the one-shot Node checker hidden. No resident service is installed and no password is stored. The Startup folder path can be empty in this environment, so the current APPDATA is used as a fallback — verified in practice.

Notifications use reserved batches plus per-object cycle/cooldown accounting; when Windows rejects delivery the failure is recorded and the reservation released. Pending records from a process crash after delivery are not retried immediately, prioritising the avoidance of duplicate popups. SQLite `BEGIN IMMEDIATE` handles cross-process contention, and a data-lock file lease coordinates the checker with full-database backup/restore. The checker refuses to create an empty database when it is missing.

Protocol names are distinguished by a digest of the data path; the open script validates the route allowlist, port and database identity, cold-starts the local service if needed, then opens the corresponding page. `stop.bat` / `scripts/stop.mjs` use a same-origin protected shutdown endpoint and verify the data path, distinguishing the background local service from the independent reminder task.

The backup version changed from a fixed 005 to the current migration number; 005/006 packages are accepted and upgraded through shared migration functions. System tasks are closed before restore, and the candidate database defaults to `desktop_enabled=0` so the user reinstalls afterwards, avoiding a mismatch between task schedule and restored configuration.

## Phase 6 increment (v0.6.0 / 007)

Still Node.js 24 + native SQLite/HTTP + HTML/CSS/ES Modules with zero new runtime dependencies, keeping the four-entry navigation, layout and theme. New services: `usage.mjs`, `presets.mjs`, `search.mjs`; new pages: `usage.js`, `presets.js`, `search.js`, `quick-actions.js`, plus `experience.css`. Settings sub-routes are `#settings/usage` and `#settings/presets`; `#search?q=` provides unified search; `#journal/person-:id` shows a participant profile.

The frontend `services/usage.js` `ActivityClock` measures real time with `performance.now`, combining `visibilityState`, `hasFocus` and user input/pointer activity. It pauses after 10 minutes of inactivity, heartbeats every 15 seconds, caps a single slice at 30 seconds, accepts only the last two minutes of late data, and treats sleep/freeze conservatively. The server merges `app` and `project:ID` intervals separately and deduplicates receipt IDs for idempotency, preventing multi-window double counting. Statistics only write `usage_*` and never touch project revision, `updated_at`, `last_followed_at` or development logs. A visit ID is created when entering a project and reused across re-renders; leaving and re-entering creates a new visit.

Presets are data-entry templates managed uniformly by kind/name/icon/subtype/order/image/revision; default directories and initial values are registered in the 007 SQL data. Choosing a preset creates or fills an independent business record and stores an icon/image snapshot; business records never depend on preset IDs. Deleting a template does not cascade into history, and "restore defaults" only fills in missing names. Images live on the filesystem, are registered in `file_objects` and participate in existing move, path, recycle bin and full-backup verification; `file-paths.usage` also reports icon references to avoid silent image deletion.

Global search uses parameterised SQLite LIKE with literal wildcard escaping, limited to 50 items per type, which suits current personal local data volumes; no search service or external dependency was added. FTS can be introduced locally if content grows. Log search results carry `?log=ID`, expanding, highlighting and scrolling to the record in the detail view; category and tag results open the existing filtered lists. Recent activity is aggregated from real business `updated_at` values and never mixes in usage statistics.

Backups accept 005/006/007, migrating older packages before restore; new statistics tables, presets and images persist through the full snapshot. The existing Windows reminder pipeline keeps using the same rule service; this phase neither installs nor modifies system tasks.

## Phase 7 · Frontend design layer

v0.7.0 changes no backend, migration or API. `tokens.css` provides the `pd-*` semantic system plus legacy token adaptation, `studio.css` consolidates shell/pages/controls; `ui/day-night.js` ports Canvas and interaction from the user's HTML with scoping limited, `ui/studio.js` owns theme bridging, commands and page organisation, and `project-card.js` shares the real project card. `preferences.js` partitions browser UI preferences by `databasePath`; the theme keeps using the existing settings endpoint. Seven main pages were adjusted incrementally within the existing routes / bind / refresh structure, and business writes and statistics follow the original logic entirely. Detailed interaction contracts are in `UI_DESIGN_SYSTEM.md`.
