# PROJECT DESK Phase Progress

Updated: 2026-11-18. Currently **v1.0.0 — Released / Stable**; the startup-log fault tolerance fix, 41 regressions and the final main-page/theme smoke tests are complete.

## Startup log fix and final re-verification

- Confirmed the original log is readable and not read-only, but the current execution environment refuses write handles (Node r+/a return EPERM, PowerShell is refused too). The old launcher's `openSync`/`writeSync` had no exception handling, so an optional log could block startup or potentially kill the service; the underlying permission restriction source was not guessed at and no ACL was changed.
- Only `scripts/startup-log.mjs` was added and wired into `launch.mjs`, plus adjusted error text in `start.bat`. Normal log appending is unchanged; on failure the app closes its own log handle, reports once and continues with window output — no substitute log directory, no permission changes. Business, database and UI code untouched.
- Added four log regressions in `tests/startup.test.mjs`; **npm test 41/41 pass, 0 failed/skipped**, about 8.52 seconds. The original 37 keep passing.
- Actually launched `start.bat` from the root with an isolated TEMP dataset and used a dedicated Chrome acceptance tab to check Overview, Project Archive, Project Detail, Revisit Center, Digital Resources and Settings, plus the follow-up centre and text material detail. Created a test project at 37%, one log and one text material with an association; list/overview/follow-up/material interlinking behaved correctly.
- Light/Dark/Follow System, direct compact-slider clicks, theme panel expand/collapse, settings form synchronisation and persistence across refresh all pass. Follow System actually matches the current OS dark appearance; no system appearance simulation was altered and no claim is made about re-verifying every animation boundary. No obvious layout anomalies; the acceptance tab captured `error=[]`, screenshots are in this round's tool records.
- After identity verification `stop.bat` closed normally; `start.bat` was run again from the root for a cold start and projects, logs, materials, categories, participants/associations, memos and theme snapshots matched; a final `stop.bat` closed normally, both launch sessions exiting with code 0. Port 60459 finally returned ECONNREFUSED.
- Closed the dedicated acceptance tab; the newly created temporary directory's absolute path/name were verified before cleanup, with no production data contamination. The aggregate fingerprint of 65 files across server/public/production data and the original log fingerprint are unchanged. Historical output, screenshots and audit test copies were not deleted.
- The previously blocked smoke tests are now filled in; FINAL_RELEASE, PROJECT_STATUS and README were updated — see STARTUP_FIX_REPORT. Documentation is marked **Released / Stable**, retaining the boundaries around the real Windows shutdown notification chain, the second physical disk and browser-preference backup; the About page's historical phase copy is left unchanged per the no-UI-change rule.

No new confirmed Critical / High issues. v1.0.0 development ends here without new features or starting the next phase.

## Phase 8.3: first Final Acceptance (historical, since re-verified)

- Read PHASE82_REPORT, RELEASE_ISSUES, PROJECT_STATUS and this file, then ran the existing `npm test`: **37/37 pass, 0 failed, 0 skipped, about 8.62 seconds**. No tests were expanded and no new full audit was performed.
- Actually ran `start.bat` from the root with an isolated empty TEMP data directory and port 50793, suppressing automatic browser launch so only the acceptance tab would be used. Opening `logs/server.log` returned EPERM and startup exited with code 1. The service never started; the attempt was stopped with no elevation, permission change, log path change or launch-path bypass.
- Overview, Project Archive, Project Detail, Revisit Center, Digital Resources, Settings, the current Light / Dark / Follow System and page data interlinking were all **unverified** this round. Untested is not a page failure; unit/API/rendering passes do not substitute for a real smoke test. No acceptance tab was opened and no other user windows were affected.
- Main version information is v1.0.0, so no business version code needed changing; historical reports keep their original versions. This phase only updated documentation and acceptance records — no business code, database structure, UI or production configuration changes.
- No business test records were created. The single new empty TEMP directory was verified by path and emptiness, then deleted; 50793 finally returned ECONNREFUSED. Production SQLite/WAL/SHM fingerprints matched before and after; historical output, screenshots, test copies and existing materials were not cleaned up.
- Creating the `output/phase83` evidence directory was also refused; that save operation was stopped rather than retried elsewhere. The full test output is in this session's terminal records, and the final observations were written to `FINAL_RELEASE.md` in the existing docs directory, without referencing non-existent test files.
- No new confirmed Critical / High business issues were found; the log permission error blocked final on-device acceptance and its cause is unconfirmed, so it was neither attributed as a confirmed product fault nor used to declare acceptance passed. Status stayed **Release Candidate**, not Released / Stable.
- `docs/FINAL_RELEASE.md` was produced, recording capabilities, tests, Phase 8.2 fixes, known boundaries and current acceptance gaps. Limitations such as Windows cold-restart notifications, the second physical disk and browser preferences not being part of database backups remain; untested items are not written as failures.

The round stopped here, awaiting normal startup to complete the user-specified ordinary smoke tests before final release, without entering a new development phase.

## Phase 8.2: Final Release Fixes

Based on confirmed items R01–R07 in `RELEASE_ISSUES.md`, local fixes were completed in High → Medium order, along with R08 version/documentation consistency. Node.js 24 + native HTML/CSS/JavaScript + SQLite, local HTTP, file management and Windows reminders are retained; no Git operations, new dependencies, migrations or new business features. Historical phase records keep their original versions and conclusions at the time.

### Fix results

1. **R01 empty file reads**: zero-byte GET/HEAD now end cleanly, Range returns 416 per the original rules, and exceptions after a response is sent no longer send JSON twice.
2. **R02 interrupted restore**: state and both database digests are fsynced before the rename; startup verifies integrity, foreign keys and migration records to recover the clearly matching database; legacy marker-less leftovers or uncertain content refuse to create an empty database. Safety backups are retained.
3. **R03 restore paths**: original project IDs are recorded at recycle time; restoring to a new location synchronises shared/nested project paths and file registrations, while other projects newly occupying the old location are unaffected. Existing recycle records remain compatible.
4. **R04 deduplication misuse**: real on-disk digests and sizes are read and stale file metadata refreshed before reuse; the database's old digest alone is no longer trusted, and original files and business records are preserved.
5. **R05 workspace startup**: a same-port service is reused only when both version and database path match, otherwise it fails explicitly, leaving the original instance running and never opening the wrong workspace.
6. **R06 empty lock**: an independent SQLite file provides cross-process mutual exclusion, compatible with the legacy PID lock; an empty lock can be taken over after a short wait with diagnostic metadata retained, and business exceptions are not replayed.
7. **R07 theme sync**: the top-bar theme commit result is mirrored into the settings dropdown, reverting on failure; Follow System appearance changes preserve unsaved form drafts. Canvas drawing and CSS untouched.
8. **R08 version documentation**: version unified to v1.0.0, read by the service from package.json; README, status, data/architecture/design docs synchronised, historical versions not rewritten. Current statements such as 1–12 recent projects, backup support for 005/006/007 and the top-bar slider position were corrected.

### Verification and data protection

- **Final npm test: 37/37 pass, 0 failed/skipped**, about 8.38 seconds. The original 22 plus 15 new (including restore subtests), logged to `output/phase82/tests-release.log`. Restore tests construct isolated disk states without terminating production or other users' processes, and no real power-loss test is claimed.
- New coverage: empty-file HTTP/service survival, five restore states/empty-database refusal, multi-project paths after directory restore, global and single-resource deduplication after external modification, cross-workspace and old-version service reuse refusal, empty/live/contended locks and cross-process release, three-mode theme sync and settings rendering. **86 JS/MJS files pass syntax checks.**
- Existing regressions all pass: projects/categories/materials/participants/logs/memos/search/statistics/presets, shared file protection, full backup/restore and 005/006 migrations. Unit tests use self-created temporary data; the retained runtime copy is in `output/phase82/runtime`.
- On an isolated copy, a real **start.bat launch, repeated reuse, three-mode theme API read-back and stop.bat after identity verification** passed; port 49393 finally returned ECONNREFUSED and was stopped. An initial text-material test fixture omitted the required `favorite` field and was correctly rejected; the fixture was fixed and testing continued — not a product issue.
- The production `data` SQLite/WAL/SHM three-file SHA-256 matches the pre-phase manifest with no additions or deletions; 18 files covering migrations/styles/original slider match. No production SQLite connection, production configuration change, system reminder task or real user file was touched.
- A new-copy integrity check stopped at WinError 5 while creating a directory; the real browser run stopped on Playwright EPERM; a cold restart stopped on EPERM opening runtime.log after a normal stop. No configuration change, path change or elevated retry was attempted. The run summary was saved to `output/phase82/verification-result.json` with the file editing tool; the restricted automated result file was not generated, runtime.log is empty, and it is not treated as pass evidence. Final test logs were saved from two terminal output segments.

### Deliverables and follow-up

Full report: `docs/PHASE82_REPORT.md`; pre-restore engineering/data snapshot: `backups/before-phase82-20261118-134714.zip`. All existing audit logs, screenshots, test copies and this phase's output are retained; output is not cleaned.

No new reproducible business defects were found this round; a closing check found and fixed a template syntax error in this round's About page version copy, and the full suite passed after adding a page-rendering regression. **Ready for a bounded v1.0.0 final acceptance, but not a declaration that release conditions are met.** Final acceptance covers real theme/slider behaviour, cold restart and production data copy integrity; existing gaps such as U01–U06 notification catch-up after logon, cross-physical-disk moves and long titles remain. Phase 8.2 stops here, awaiting user direction.

## Phase 7.2: Visual Reference Alignment

v0.7.2, complete; Phase 8 not started. Pre-change source/database snapshot `backups/before-phase72-20261117-180603.zip`.

Against the original interface and the warm beige project workbench: shell and project card restructuring, paper grain and ink-wash background, warm ivory/charcoal dual themes, raised/inset layers, large rings, status navigation and filter layout; shared materials and typography unified across overview, detail, revisit, resources, follow-up and settings. Original business entries, APIs and database retained.

The original Canvas day/night slider was moved into the Topbar, sharing one engine between compact and expanded states: direct click switching, continuous follow while dragging, spring snap on release, keyboard and reduced motion, independent Follow System and SQLite theme saving. Fixed animation time-step calculation on complex pages and ghosting in the thumbnail canvas transparent area.

22 Node automated tests pass. Real browsers at 1536×1024 verified light/dark themes, click/drag/snap/expand/system/theme reload, status/name filtering and card-list memory; regressions covered project create/edit, 63% progress, archive/restore, logs, memos, text material editing with project association, the file import dialog and drawer keyboard dismissal. All seven main pages at 1280/1024/768/390 widths showed no body overflow, `pageErrors=[]`.

Final design inspection: 0 FAIL / 0 WARN; user-requested cream, ambient shadow, soft light and gradient masks retained rather than flattened per generic SaaS rules. Source lint 0 FAIL / 5 WARN (two date zero-padding, three Soft UI shadows). The production database's 34-table structure and all records match pre-phase state; 22 backend files unchanged; original files and notification mechanism retained. Production and acceptance service start/stop and isolated-database restart consistency pass.

All multi-project screenshots come from isolated acceptance databases; no sample projects or materials were written to production. One-click launch files are retained — users can double-click `start.bat`. Full report `docs/PHASE72_REPORT.md`, design system `docs/UI_DESIGN_SYSTEM.md`, screenshot gallery `output/playwright/phase72-gallery.html`. Priority/stage/task business models absent from the reference images were not implemented ahead of time.

## Phase 7: full UI/UX redesign

v0.7.0, complete, Phase 8 not started. Snapshot `backups/before-phase7-20261117-163011.zip`.

Using the user-approved Cream Studio and UI Kit plan: design tokens/shared states, a faithful port of the original day/night slider, shell, seven main page layouts, pinning/recent count, card-list memory, status and filter tags, command palette, two-level quick actions, material preview and settings grouping; both the fixed desktop viewport and small-window layouts work.

22 automated tests pass; real browsers covered theme/drag/keyboard/system/reduced-motion/refresh persistence, project edit/archive-restore, logs/memos, material editing/association and PNG upload preview, file dialog/side panel, long-list pagination and empty states. Seven main pages at 1280/900/768/390 showed no body overflow, plus a 1440 desktop screenshot, `pageErrors=[]`. The original HTML day/night endpoints were compared with actual screenshots of the ported expanded/intermediate states; the source retains the original dot matrix, OKLab, drawing, spring and sampling. Fixed startup theme flicker, transitional text contrast and legacy responsive conflicts.

Visual inspection 0 FAIL / 1 WARN (secondary metadata font size); explicit exceptions are only the user-requested cream/glow/selective neumorphism; source lint 0 FAIL / 3 WARN (two date zero-padding and light shadows). Six final inspector screenshots and main pages reviewed. Screenshot index `output/playwright/phase7-gallery.html`.

22 backend files completely unchanged; the production SQLite 34-table structure and all rows match the snapshot; bytes also matched before the startup re-check, and the SQLite header changed normally after production start/stop. The current 1 project and deleted history are preserved, with 0 materials and no fabricated production records. The theme remains in SQLite; UI preferences are stored separately in browser `localStorage` partitioned by data path and are not part of older backups.

Production `start.bat` start/reuse/`stop.bat`, isolated service cold restart, and business/theme all-field consistency pass. Windows rules/scripts/tasks unchanged; no repeated system notification or logon experiments. All cases and boundaries are in `docs/UI_REDESIGN_REPORT.md`, design constraints in `docs/UI_DESIGN_SYSTEM.md`. Phase 7 delivery stops here, awaiting Phase 8.

## Phase 6: usage statistics and experience improvements

v0.6.0 / 007-experience.sql, phase complete; Phase 7 not started. Pre-change source and database snapshot: `backups/before-phase6-20261117-112303.zip`.

### Actual output

Independent `usage_sessions` / `usage_visits` / `usage_blocks` / `usage_receipts`; frontend monotonic clock, visibility/focus/activity detection, 10-minute idle, 15-second heartbeat, server-side interval merging and idempotent deduplication. Settings show total/today/7-day/30-day, launches/average/latest plus daily trends and detail; project detail shows opens/valid time/average/latest. Browsing never invokes development writes nor touches idle anchors.

Unified `presets` / `preset_defaults` database management with 17 initial metadata rows across three kinds; all names and types remain freely editable. Add/edit/delete, icon/image, ordering, and restore-defaults that only fills gaps. Selecting a project category or participant generates an independent business record, and video platforms save their own snapshot. Images use existing `file_objects` and managed directories, extending file usage warnings, reads and backups; historical references are not lost when a template is deleted.

Cross-module search covers project descriptions, log detail, participants, material URLs/content/notes/platform, categories and tags; parameterised literal matching, 50 items per group, deleted items excluded. Results can locate a project, material, participant profile, specific log, or a category/tag filtered list. Top-bar `Ctrl+K` and a narrow-window search page; top/overview quick actions, project favourites pre-select associations, and global quick log asks for a project first; the overview gained real recent activity while keeping revisit summaries.

The four main pages, all original functionality, theme, and the Node.js + SQLite + native module architecture are retained, with no new runtime dependencies, install steps or strong visual styling.

### Verification results

- **22 Node tests pass**: 16 existing regressions + 6 Phase 6 cases. Covers idle boundaries/hidden/sleep clock, software and project interval deduplication with cross-day statistics, metadata and reminders entirely unchanged, preset add/edit/delete/reorder/restore/history, grouped search/literal wildcards/deleted filtering, image API/history references/full backup, and migration of real 005/006 packages to 007.
- Playwright actually created an in-progress 37% project and selected a category preset; filled a participant from the Codex preset and added a log with that participant; favourited a video in the project with automatic association; quick-saved a web page and text; uploaded, edited, selected and deleted an image preset with historical images still readable; deleted a participant template while history persisted and restore only filled gaps; ordering saved and the platform group browsed successfully.
- Real-browser global search, participant profile jump, `Ctrl+K`, and global quick log with a selected project all succeeded. Fixed log positioning being overridden by scroll reset on page refresh; final verification confirmed the target log entered the visible area and expanded its detail.
- Foreground measured 1822 ms over 1.8 s; refreshing a component did not double-count visits, and all project fields and reminders were identical after browsing. Background pause acceptance found Playwright's default `Emulation.setFocusEmulationEnabled=true` fakes background pages as active; with that simulation disabled and the page genuinely unfocused, the accumulated time was identical before and after a 17-second heartbeat check (increment 0), result in `output/phase6-background-result.json`. The 10-minute idle and recovery path were covered with a controllable clock, without pretending to have waited ten minutes.
- Statistics, presets, search, overview and project detail at 1440×900 / 768×1024 / 390×844 showed no horizontal overflow, main flows `pageErrors=[]`. The new preset editor is usable on narrow screens, and light/dark screenshots were reviewed. Usage statistics inspection: 0 FAIL / 1 WARN — a single neutral chart lacks a data accent colour, retained intentionally to match existing style, with formal colouring deferred to Phase 7. Source lint 0 FAIL / 2 WARN, both date zero-padding.
- Real `start.bat`, repeated-launch reuse, `stop.bat` and cold restart pass; statistics stop increasing with the independent service after the browser is closed. Business data, ordering, images, theme, software and project statistics are identical across restart, result in `output/phase6-restart-result.json`.
- Production launch defaults to 4317 with health `phase=6/schema=007`; the service reads 1 production project, 0 materials, 17 presets and 0 usage sessions. Compared with the pre-phase snapshot, all 28 original tables match on original fields and 14 original rows; only the migration record and preset image storage root each added a row. No fabricated production records; database integrity and foreign keys normal.

### Practical boundaries and usage

Double-click `start.bat` and open statistics/presets in settings; top-bar search and quick actions, project detail for usage. Command-line `npm start` / `npm test` unchanged. Statistics begin with v0.6.0 and never fabricate older history; page load is the launch counting unit and a full refresh counts once. Abnormal exit may lose the final ~15 seconds; freeze/sleep uses a conservative upper bound; brief network failures retry only the last two minutes. Multi-window intervals are unioned before averaging, including in-progress visits.

Preset images are capped at 2 MiB while other materials remain at 512 MiB; deleting a template does not delete files. Restore defaults does not overwrite edited entries, renamed entries stay and original default names can be added back. Search currently uses local LIKE, adequate at personal scale, with FTS to be evaluated if data grows. This phase changed no production Windows tasks and did not enter the overall UI redesign.

Required documents README, PROJECT_STATUS, ARCHITECTURE and DATA were all updated; production and acceptance services stopped, temporary acceptance databases cleaned, screenshots/test sources/necessary results/pre-phase snapshots retained; awaiting user direction for Phase 7.

## Phase 5: reminders and smart revisit

Version v0.5.0, migration 006; stops after completion, Phase 6 not started. Pre-change snapshot `backups/before-phase5-20261117-103025.zip`.

### Actual results

- Original features, data, theme and the zero-dependency architecture retained. Added reminder settings/override rules, handling history, notification batches, per-object deduplication and runtime records.
- Project idling uses creation time, effective log events and actual save moments, non-empty work memos and manual "continue following", ignoring ordinary `updated_at`; paused/completed/abandoned/not-started and archived are excluded by default. Materials use favourite/view times, excluding learned/used/archived.
- Global/project/material switches, custom 1–3650 day cycles, category and per-item overrides, snooze, pause/resume, repeat interval. Continuing to follow does not change status/progress; viewing does not change learning status.
- The revisit centre filters by project, material type, local due date and scope with direct handling; the latest 300 handling records are shown, and the overview surfaces real due summaries.
- One Windows task for the current user: daily at a specified local time and at logon, with StartWhenAvailable, Interactive/Limited, IgnoreNew, run on battery. An independent short-lived Node checker reads the same SQLite directly and needs no resident HTTP service.
- WinRT desktop summary, Start-menu AUMID, dedicated URL protocol; notifications include the revisit centre and up to 3 specific object entries. All text is XML-escaped and activation routes are allowlisted. Clicking an entry can check port/data directory, cold-start the service and locate the target. Added `stop.bat`, distinguishing stopping the service from closing independent reminders.
- Notification batches are reserved before delivery; failures release the reservation and log the error; repeats are limited by cycle/cooldown. A file lease coordinates background checks with backup/restore, and SQLite transactions handle rules/actions/deduplication. The checker refuses to create an empty database when it is missing.
- 006 backups are compatible and 005 packages still migrate on restore; old tasks are closed before restore and must be re-enabled afterwards, avoiding a mismatch between old schedules and new rules.

### Verification results

- All 16 Node automated tests pass, covering earlier-phase regressions, status/progress independence, excluded states, category and per-item cycles, pause/resume, snooze due boundaries, handled-then-due-again, history reopening, batch summarisation/cooldown deduplication, delivery failure retry and global disable.
- Playwright actually completed type filtering, pause/resume, continue following, snooze 3 days, per-item 15 days, category 90 days, project-global 15 days and marking learned to exclude. After operations the project remained in progress at 37%, and history and rules were written to SQLite; the new page and overview at three widths showed no horizontal overflow, `pageErrors=[]`.
- Registered a real test task `PROJECT-DESK-04d3a1158f16` successfully, queried both triggers with `StartWhenAvailable=true`; after changing 09:00 to 23:59 the same task persisted without duplicates.
- The first notification was rejected by Windows `DisabledForUser`, with read-only diagnosis `ToastEnabled=0`; after the user enabled notifications, Windows returned `Enabled`, `submitted=true`, `historyCount=1`. Fixed a zero-value enum string conversion so the UI can explain why system notifications are off.
- With both the browser and local service closed, running the task actually produced `count=2` with system task `LastResult=0`; a second run produced `count=0` with no duplicate popups. Simulating expired check time/notification cooldown records and running again gave `count=2`.
- Global disable verified by actual Windows uninstall (`installed=false`) with in-app due items cleared; re-enabling global did not silently install the task. After another explicit install, the service cold-started through the Windows protocol with `activation.log` recording `journal/reviews` and the correct port; handling history persisted across restart. `stop.bat` actually stopped that background service. The test task was uninstalled again, and the Start-menu identity, protocol and test notifications were cleaned for that instance.
- The user's machine was not actually shut down or logged off. Catch-up acceptance used simulated expiry + real task execution + trigger configuration, retaining this real-world verification boundary; no full-machine reboot experiment is claimed.
- The production database upgraded to 006; compared against the full pre-change SQLite backup (including WAL), all 21 original tables match on original fields and the existing 1 project is preserved, with no test data in production materials, reminder history or deliveries. Database integrity and foreign key checks normal.
- Revisit centre at 1440×900, 768×1024, 390×844: 0 FAIL / 0 WARN, six screenshots reviewed. Achromatic ledger, system fonts and neutral colours retained; source app lint 0 FAIL / 3 WARN (two date zero-padding uses and default dashes). No overall beautification was undertaken.

- Finally stopped production and isolated services, uninstalled the test scheduled task and dedicated identity, cleaned the isolated database and the comparison temp directory, retaining sources, screenshots and the pre-development ZIP. Existing user data was not deleted; the Windows global notification switch remains as the user set it.

### Usage and limitations

The top-bar "Revisit Centre" or the overview's pending-review entry opens `#journal/reviews`; Settings → reminder rules and Windows notifications opens `#settings/reminders`. Save the cycle and daily time first, then click install/update time, then test the notification. To turn off independent reminders use "close and uninstall"; closing the browser does not stop the service — use `stop.bat` for that, which also does not uninstall the system task.

Notifications are not registered automatically; only in-app reminders are on by default. Do Not Disturb or disabled system notifications suppress toasts, and successful delivery does not mean the user read or learned anything — those states require manual confirmation. Interrupted `pending` keeps its cooldown to avoid duplicates, and failed batches can retry. Dates use local calendar filtering while cycles are computed over 24 hours. History shows the latest 300 with everything retained underneath. Tasks must be reinstalled after the program or data location changes.

Implementation references: [Task Scheduler StartWhenAvailable](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasksettingsset), [daily and logon triggers](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasktrigger), [desktop notification AUMID](https://learn.microsoft.com/en-us/windows/win32/shell/enable-desktop-toast-with-appusermodelid). Actual conclusions rest on the on-device acceptance above.

## Phase 4: local file system and data management

Version v0.4.0, data version 005; stops after this phase, Phase 5 not started.

- Pre-change snapshot: `backups/before-phase4-20261117-081900.zip`, with matching source and data. Old migrations, fields and user content retained, zero new runtime dependencies.
- Configurable image, video, attachment, project file and other directories; in-app disk/directory selection with multi-file checking. The legacy Windows FolderBrowserDialog misbehaves on this machine, so the final implementation does not depend on PowerShell dialogs.
- Copy/reference, drag-and-drop multiple files, batch path import, duplicate content reuse, per-item results and errors; 512 MiB in the browser with local copy/reference beyond that. At most 200 files per batch.
- File bodies are separate from material assets: one file can serve multiple projects through the same material; real paths, sizes, basic image/video preview, rename/move, folder creation, directory browsing, Explorer, staleness warnings and digest-verified relink.
- Project detail can associate an existing directory, create a managed project directory, relink and unlink. File and directory moves maintain shared references and project directories.
- File recycle and material recycle are shown separately; restore, permanent delete and empty require explicit confirmation. Permanently deleting a material record keeps the bytes; referenced files are managed as references only and the original file always remains. Managed file deletion shows usage scope first, and folder recycling requires confirming overall impact.
- `disk_jobs` persists move plans; same-volume uses rename, cross-volume copies and verifies before committing the registration; interrupted recovery repairs paths where possible, retaining uncertain duplicate copies flagged for inspection.
- A local directory-package backup covers the full database, managed files and recycled content; newly added source files inside managed project folders are included. SHA-256, SQLite integrity and foreign keys are verified; external references only store and check paths. Restore prepares an independent file directory first, then saves a pre-restore snapshot and switches the database without overwriting the original directory.
- Fixed form input being cleared by a second render after fast route switching, and the picker's first read overwriting the user's typed address. Forms/dialogs are not refreshed while editing when the window gains focus.

### Actual verification

- All 13 Node automated tests pass: earlier-phase regressions, copy/reference, duplicate content, shared associations, folder/file moves and renames, directory migration, path staleness and relink, material and file recycle/restore, permanent delete boundaries, corrupted-backup refusal, full restore, persistence across reopen, copy and reference of the same path used together, interrupted move recovery and offline root relink.
- Playwright completed real form flows for custom directory settings, changing the default image directory, DOM drag-and-drop import of two files, reference path import, picker backfill and multi-file selection. Images actually decoded and a referenced WebM actually played; one image was shared by two projects.
- UI completed moving a file into a subfolder and renaming it, renaming a directory, migrating an entire storage root to a new empty directory with usage scope and associations unchanged; file/folder recycle and restore; material record deletion then restore; external reference removal and restore; project directory creation.
- An external rename was simulated with an isolated source file; the UI showed the path as stale and relink restored usability. The referenced original file still exists.
- UI created a backup, inspected it, entered the restore confirmation, actually replaced the whole database and kept a safety snapshot. After restore and restart, 2 acceptance projects, 5 materials, 3 managed files and 3 external references were usable; the managed project folder's `source.js` was restored too. Business tables matched the backup; view times and post-restore paths were checked separately per business rules, and managed file digests matched.
- The Explorer entry actually opened the source folder, confirmed by the Windows window list. Reading window contents afterwards was not executed because the tool approval timed out; no further operations on other user windows.
- The production database migrated to 005; compared table by table with the pre-change ZIP's full data including WAL, all original fields match and the existing 1 project is preserved. Production resources and files are both 0, with no acceptance content mixed in. `integrity_check=ok`, `foreign_key_check` clean.
- File management `inspect --app` at 1440, 768 and 390: 0 FAIL / 0 WARN, six screenshots reviewed. Layout retains the theme, neutral colours and existing Achromatic ledger without early overall beautification. Source app lint 0 FAIL / 2 WARN, the original date zero-padding and default dash retained.

- Final regression covered nine old/new pages × three widths plus the import dialog at three sizes, with no horizontal overflow and `pageErrors=[]`; dialog screenshots reviewed. Production and acceptance services closed, isolated databases, backup packages and source test directories cleaned, with sources, pre-development snapshots and screenshots retained.

### Usage, limitations and follow-up

Entries: Library → File management / Recycle bin; Settings → Storage directories / Backup and restore; Project detail → local project folder. Launch is still a double-click on `start.bat`.

Backups are full directory packages, not ZIPs, and are not encrypted; only the 005 format is accepted at this stage. Missing files block a full backup by default and can be allowed with a non-complete label. Content never imported into ordinary external directories is not backed up automatically, and external project folders only keep their paths. Referenced original files are read-only in management; actual move/rename applies to managed directories. Symlinks and directory junctions are not followed.

Cross-volume moves on a second physical disk have not been fully accepted, nor have large-scale file-count/capacity performance benchmarks. Folder drag-and-drop batch import, compression/transcoding, cloud sync, encryption and scheduled automatic backups are not implemented. Interrupted backups keep an INCOMPLETE marker and cannot be restored; uncertain file moves keep both copies and warn for inspection. Phase 5 reminders and smart revisit await separate user scheduling.

## Phase 3: digital library

Version v0.3.0, migration 004; only this phase completed, Phase 4 not started.

### Actual results

- Pre-change snapshot `backups/before-phase3-20261116-213941.zip`. Node 24, SQLite, native modules, page shell and theme retained, zero new runtime dependencies; the outline document unchanged.
- Six material types: video URL (free-text platform), web page, text note/prompt/plan, uploaded image, local video, other attachment. Each type shows the fields it needs, with detail, edit and confirmed soft delete.
- Material categories with icons, editing, ordering and delete-and-transfer; tags and collections each add/edit/delete and order independently, with multi-select on materials. Favourite flags are separate from organisation relationships, and no platforms, categories, tags or collections are pre-seeded.
- Name search; type/category/tag/collection/status/favourite filtering; bidirectional sorting by favourite and modified time; 30 per page; secondary filters collapse on narrow windows.
- Unsorted, to view, learning, learned, used and archived are all set manually. Creation time serves as favourite time, and last viewed is recorded separately; viewing never changes status or modified time automatically.
- One material can link to multiple projects — project detail checks existing materials, material edit checks projects — both referencing the same record without copying content. The overview uses real material counts and recent-modification links.
- Uploads stream into `assets` under the data directory, reusing identical bytes by SHA-256; the database stores description and references, supporting safe download, image preview and video Range playback. Source files, old assets and soft-delete history are retained; full file management was not yet implemented.
- Material writes use a 256 KiB JSON limit to accommodate a 30000-character Chinese body while other JSON stays at 32 KiB; single files max 512 MiB. Upload and metadata are two steps, errors preserve saved information and allow retry/re-upload, and duplicate submission during saving is blocked.

### Verification results

- **All 10 Node automated tests pass.** Project/category/participant/log/memo regressions keep passing; new coverage includes six-type CRUD, the six manual states, favourite independence, view time, a 30000-character Chinese note, category transfer, tag and collection relationships, one material with multiple projects, duplicate URL validation, invalid input and same-origin protection.
- Association history boundaries were checked and fixed: project-side edits keep links to soft-deleted materials; material-side edits keep links to soft-deleted projects; association changes on either side bump the relevant revision, and stale windows are refused. Collections are identical after reopening the database, with foreign keys and integrity normal.
- Upload tests verified on-disk bytes against HTTP reads, PNG format detection, identical-content reuse, rejection of bad/empty files, GET/HEAD handling, 206/416 range responses, forced attachment download, and that after deletion the current asset is unreadable while the disk file remains. Automated assertions cover GET range reads; HEAD handling shares the same read branch.
- Playwright verified the full form flow for all six material types — create, edit, status change, favourite toggle; free-text platform, text body, image decoding, real VP8/WebM playback, attachment download with the original file name and opening a URL in a new tab. Reusable acceptance scripts `browser-phase3.js`, `review.js` and `delete.js` were saved, each restricted to the isolated `phase3-test-data` database.
- Actually clicked through category icon/rename/order, category deletion that transfers to another category and then to uncategorised, and tag/collection rename and delete. After deleting organisation objects, all six materials remained. Actually deleted materials of all six types, cancelled deletion left them unchanged, and confirmed deletion hid them from both the library and project detail.
- Name/type/category/tag/collection filtering and sorting work; one image was associated with two projects, and another attachment unlinked from one project remained unique and associated with the other. The overview actually showed six materials, consistent with the data source.
- Actually stopped the acceptance service with Ctrl+C and restarted via `start.bat`: ten collections — projects, categories, participants, memberships, logs, work memos, materials, material categories, tags, collections — were identical; current asset bytes for the image, video and attachment matched their on-disk digests. PowerShell omits trailing zeros in timestamps, so comparisons normalise by ISO time semantics without modifying stored values.
- The production database upgraded from 003 to 004; compared table by table with the pre-change full SQLite directory (including WAL), all original tables/fields, the existing 1 project and theme settings were fully preserved; the production library remains at 0 with no acceptance content written. `integrity_check=ok`, `foreign_key_check` clean.
- Real-browser regression across five pages and light/dark/follow-system save and refresh, final acceptance `pageErrors=[]`. No horizontal overflow on pages or dialogs at 1440×900, 768×1024, 390×844; image detail and edit dialogs at three widths reviewed.
- Final library `inspect --app` at three sizes: **0 FAIL / 0 WARN**, results in `.taste-skill/phase3-final/report.json`, six screenshots reviewed. Source `lint --app`: 0 FAIL / 2 WARN, for `padStart` date formatting and default dashes, retaining real date formats and default display. Misapplying marketing-page rules would flag the app chrome as an issue, so app rules were used for acceptance.

- A read-only check of the production library page showed 0 materials, console Errors 0 / Warnings 0. Acceptance and production services both stopped, isolated databases and comparison temp files cleaned, with sources, screenshots and pre-change backups retained.

### Interface review and scope

Retained Achromatic ledger (seed 1215761365), system fonts, and neutral light/dark themes. The library's primary question is "what materials exist and how do I find them", so the largest area is the unified material list with image thumbnails and type text to aid recognition; detail answers "what is this and which projects use it", and the editor shows fields by type. No simulated statistics, remote covers, brand platform enums or demo favourites.

The first mobile screenshot showed filters pushing materials off the first screen, so secondary filters were collapsed; mixed image/text card heights were inconsistent, so compact thumbnails and title layout were unified. Final edges, row bottoms and card spans align; small windows can read the first material, and detailed editing can scroll vertically to reach the save button. Base visuals were kept without overall beautification. All acceptance materials in screenshots come only from isolated databases.

No known blockers. Images support only PNG/JPEG/GIF/WebP; video is basic in-browser preview of MP4/WebM/Ogg containers (acceptance playback used WebM; arbitrary codecs are not guaranteed), with no transcoding; documents/archives/code download as attachments. Files max 512 MiB with no large-scale performance benchmark. Lists still read the full bootstrap with frontend paging, to be optimised as data grows.

Soft delete, replacement and unlinking never delete real files, and there is no delete-restore UI yet; abnormal interruptions may leave temporary/unlinked content, with full rules designed in Phase 4. No custom directory UI, external references, folder management, batch import, automatic backup/restore or revisit reminders. The phase stops here, awaiting Phase 4.

## Phase 2: AI / Agent and development history

Version v0.2.0, data migration 003. Stops after completion, Phase 3 not started.

- Pre-change backup: `backups/before-phase2-20261116-211051.zip`. All existing tables, fields, projects and Phase 1 capabilities retained, new migration added, no dependencies installed.
- Custom participant name/type/responsibility with create, edit, delete and list. The roster starts empty with no preset brands.
- Project participants and per-log participants are associated independently; newly selected log participants are added to the overall roster. Deletion keeps a historical marker, and removal from the project roster is refused while any log still references the participant.
- One-line quick logs; detailed editing can add title, date-time, files/features, result, problems, next step and notes; supports important milestones, editing and soft delete.
- Timelines support local date ranges (inclusive), log participants, important milestones and ascending/descending time; the global view adds project filtering. Content expands for reading and text is escaped.
- Per-project current work, problems, ideas and next step are saved independently; project detail and the follow-up centre share SQLite data and never auto-generate logs.
- 7 automated tests pass; after fixing a missing validation parameter for roster removal when a log references a participant, retesting passed. Earlier migrations and HTTP tests also pass.
- Playwright verified participant creation/responsibility edit/deletion, a project associated with two participants while a log selects only one, quick recording, expanding detailed editing, log deletion, date/participant filtering, memo interlinking across pages, and the historical marker after participant deletion.
- The service was actually stopped and restarted; projects/participants/project roster/logs/work memos were fully consistent.
- After migration, the production database was compared table by table with the full SQLite data directory in the backup (including WAL): the existing 1 project, categories, settings and material data are identical; no acceptance content was added to production.
- Final database `integrity_check=ok`, `foreign_key_check` clean. After acceptance the service and browser were closed, isolated databases and comparison temp files cleaned, screenshots and backups retained.
- Follow-up centre at three sizes: 0 FAIL; the only WARN was a "no data colour" hint after the textual timeline was misread as a chart — the text event stream keeps neutral colours. Project participant area, timeline and detailed edit dialog screenshots reviewed, no horizontal overflow at three widths. Console Errors 0 / Warnings 0.
- Design retained Achromatic ledger (original seed 1215761365) and system fonts without re-drawing the style. The main questions are "who has taken part in this project", "who took part in this change" and "what needs doing now". The compact work summary and expandable timeline answer them respectively.
- All acceptance names, projects, logs and memos in screenshots come from isolated test databases. Production contains no seeded data. Automated style source checks show no FAIL; the date zero-padding hint relates to date formatting, and the colourless-timeline hint targets a text event stream, so no meaningless colour was added.
- Phase 3 material favourites, media import and attachment management were not implemented; no model API or extra cloud services. Log editing is not a version snapshot, and no delete-restore UI was provided yet.

## Phase 1: project archive foundation

Complete, version v0.1.0. Development stopped, awaiting Phase 2.

### Actual results

- Continues Phase 0's local service, SQLite, page shell and theme with no new runtime dependencies; the original outline unchanged.
- Saved `backups/before-phase1-20261116-201705.zip` before changes, containing source and the original database. Added migration 002 without rewriting 001.
- Project create, edit, soft delete; name, description, created/updated times, five statuses and 0–100 integer progress with a unified SVG ring.
- Free category create/edit, built-in icons or custom symbols, favourite/unfavourite, move up/down ordering; deletion can transfer to a target category or uncategorised, transactionally, without deleting projects.
- Project list with name search, category/status filtering, bidirectional sorting by created/updated time, archive scope and 30 per page; filters persist in the current address.
- A separate project detail page and edit entry; archive/restore preserves original status, progress and category.
- Overview uses real project statistics (including archived, excluding deleted), recent 5 by update time, with unified progress display.
- Dialogs prevent duplicate submission while saving and preserve the form on error; edits carry a revision so stale windows cannot overwrite newer content.
- AI / Agent, logs/timelines, material association and local directories had placeholder explanation areas only; Phase 2 not started.

### Verification results

- 5 Node automated tests pass, covering blank initialisation, retention of Phase 0 records/theme after migration, migration idempotency, project CRUD, all statuses, independent progress, category CRUD/favourite/order/transfer, archive/restore, filtering and sorting, database reopen, stale version conflicts, invalid input, same-origin protection and static directory isolation.
- Actually launched an isolated test service with Windows `start.bat`; after stop and restart, project and category collections were item-by-item identical. The production service was also started for verification with `schemaVersion=002` and production business data still empty.
- Playwright created categories and projects through real forms; a project went from "in progress, 37%" to "paused, 70%", and remained "paused, 70%" after archive and restore.
- Real UI verified category rename, custom symbol, favourite toggle, ordering, and deletion transferring to another category; then verified deletion transferring to uncategorised with all 5 projects preserved.
- Verified name search with empty results and matches, status filtering, more filters, creation-time sorting, archive list showing only archived projects, and restore returning to the unarchived list.
- Project deletion cancelled first, keeping the project; confirming deletion removed it from lists and statistics. File safety and the database soft-delete marker were verified by automated tests.
- The isolated database prepared one project per status, and the Dashboard showed total 5, one per status and 5 recent projects, consistent with the data source. Acceptance data was never written to production.
- Regression across overview/projects/follow-up/library/settings, and light, dark and follow-system themes persisted after refresh; the storage sidebar opened and closed with Escape.
- Browser console Errors 0 / Warnings 0. Source style check 0 FAIL / 0 WARN.
- Project list, detail and overview final checks at 1440×900, 768×1024 and 390×844 all **0 FAIL / 0 WARN**; screenshots reviewed, no horizontal overflow on narrow windows, and the create dialog usable.

### Interface review and scope

Retained Phase 0's Achromatic ledger (seed 1215761365) and system fonts without re-choosing a style. The list's primary question is "what projects exist", detail's is "what is this project's situation", and the overview's is "the overall state of projects now"; the largest areas are the project list, basic info with the ring, and real statistics with recent projects.

Fixed the detail panels' mismatched bottom edges and the overview's oversized auxiliary empty state by using a shared detail surface and a compact auxiliary panel. Numbers come directly from SQLite with no fabricated trends; progress for the same project always reuses the unified ring component. Future modules are explicitly labelled with their opening phase. The two whitespace warnings in the initial empty-list check are the genuine state of having no projects, so empty states and the "new project" entry remain rather than filling with fabricated content.

The "acceptance category", "transfer target category" and all "acceptance" projects in screenshots exist only in the isolated `output/phase1-test-data` database; the test service was closed and that database cleaned after acceptance. The production `data` directory contains none of it.

### Limitations and follow-up

No known blockers. Projects use soft delete with no delete-restore UI yet; archived is preferred for projects worth keeping. The list filters in the browser with no server-side pagination, to be optimised for very large personal datasets. Not yet verified on a separate Windows 10 device; no desktop shell, automatic backup/restore or notifications. Phase 2 will handle participants and development history separately and did not start here.

## Phase 0: architecture confirmation and foundation

Implementation complete; development stopped, awaiting user acceptance and the next phase.

### Actual results

- Read the parent directory's `大纲.txt` (outline) in full, leaving the original file unchanged. The new project lives in its own PROJECT DESK subdirectory.
- Reused the existing Node.js 24.21.0 / npm 11.19.0; no new Node, database service or desktop framework installed, and no Git repository created.
- Node local service + native modular interface + SQLite, with zero third-party runtime dependencies.
- Established five pages: overview, project archive, follow-up centre, library and settings; Phase 1 project editing was not included.
- Theme, navigation, base components, error retry, dialogs, sidebars, stable window layout and independent content scrolling.
- Empty business database, transactional migrations, basic constraints and association boundaries.
- Windows one-click launch, startup probing, repeated-launch reuse and append-only run logs.

### Verification record

- Windows `start.bat` actually launched successfully with a working HTTP service; repeated launch reused the running service; after Ctrl+C, launching again succeeded.
- Both automated checks pass, covering blank database creation, migration idempotency, progress range constraints, theme persistence across reopen, database integrity, same-origin write validation, theme validation, static path isolation and unopened business endpoints.
- Actual database `integrity_check` is ok. 0 projects, 0 logs, 0 materials; all business tables empty.
- Playwright actually clicked project archive, follow-up centre, library, settings and back to overview with correct page titles and headings.
- The dark theme persisted after refresh; follow-system was restored after verification. Temporary test data was written only to a temp directory and cleaned up.
- The storage explanation side panel opened and closed with Escape. Desktop screenshots and layout screenshots at 1440×900, 768×1024 and 390×844 reviewed; narrow windows and desktop measurements showed no horizontal overflow.
- Browser console Errors 0, Warnings 0. Source style check 0 FAIL / 0 WARN.
- Real-browser design inspection once found a link too close to the screen edge, which was moved inside the 16px page margin, and primary auxiliary text was raised to 13px; final checks at 1440, 768 and 390 were **0 FAIL / 0 WARN**, results in `.taste-skill/final/report.json`, six final screenshots reviewed.

### Design record

Used Achromatic ledger, seed 1215761365, without re-extracting a style. System fonts and neutral colours match the foundation-phase requirements of the outline. The outline explicitly requires a top area, so the top bar is retained; settings use a unified panel rather than a complex multi-column layout. No photos, remote fonts or sample content.

Primary questions per page: overview "what projects and pending follow-ups exist"; project archive "what projects exist"; follow-up centre "where is the development history"; library "what materials exist"; settings "what are the theme and local storage". All currently render the genuine empty or not-yet-available state. Visual checks focused on navigation visibility, empty states, alignment and window scrolling; information density will be reassessed as business data grows, without fabricating data to fill pages.

Final review: the largest number directly answers the project total; all category counts sum to the total of 0; panel edges and row bottoms align; no fabricated charts, change rates or reminder counts. Narrow windows keep full text navigation inside the scrolling main area. Settings content limited by window height remains reachable via main-area scrolling. The currently empty business makes some pages sparse, which is in scope; formal visual identity and data-rich layouts are deferred to later phases rather than expanded as current defects.

### Important limitations

- Currently a local browser tool — no standalone desktop installer, tray icon or notifications after closing the window.
- No full business CRUD, global search, reminders, material import or automatic backup/restore; all belong to later phases.
- Verified only on this Windows machine, with no separate Windows 10 device.
- Node's built-in SQLite is still under active development, so 24.x is pinned and driver calls are centralised.
- Run logs are currently an append-only file; rotation should be added in a later phase before long-term operation.

## Phase 0 next-phase suggestion at the time (historical)

Advance only Phase 1: project create/edit/delete, custom categories, independent status and progress, ring, detail and statistics. Add fields and migrations first, then wire up pages; deletion follows the outline and never deletes real files. Keep a cold backup before important data structure changes. Do not bring forward logs, materials or full reminder functionality.

## Subsequent status

Phases 0–7 complete, Phase 8 not started. Follow-up work uses the parent directory's `大纲.txt` as the long-term basis and user instructions to determine scope.

Delivery status: production and isolated services stopped, acceptance browsers closed, Phase 7 temporary databases and comparison copies cleaned. Pre-change snapshots, test sources, before/after screenshots, check results and design documents retained.
