# Startup Log Fix and Final Smoke Re-verification

Date: 2026-11-18; version v1.0.0. Only startup-related implementation, tests and delivery documentation were changed — no business, SQLite or UI changes.

## Cause

`logs/server.log` has the Archive attribute, is not read-only, and is normally readable. Under this execution identity/environment, Node v24.21.0 returns EPERM when opening it with r+ or a; PowerShell, which only attempts to obtain a write handle without writing content, also returned access denied. This is not a guess from the error about the Node version, read-only attribute or file content; the specific source of the underlying permission denial was not further confirmed and system permissions were not changed.

The direct program-level cause is confirmed: `scripts/launch.mjs` called `openSync(log,'a')` without protection before creating the service child process, treating an optional file log as a hard startup dependency; runtime `writeSync` failures were also uncaught. A non-writable log therefore either aborted startup outright or made the running log listener exit abnormally.

## Minimal fix

- `scripts/startup-log.mjs`: normal operation still appends to the original log. On create/open/write/close failure it only disables file logging, clearly showing the error code and file location; stdout/stderr keep appearing in the launch window. Partial writes are handled, its own handle is released, and the error is reported only once.
- `scripts/launch.mjs`: wired to this log module, keeping the original version/workspace verification, launch flow, browser entry and process management; when file logging is unavailable it correctly points to the current window.
- `start.bat`: failure messages no longer point only at a possibly unavailable log file.
- `tests/startup.test.mjs`: four regressions — append to history, open/create-directory refused, write failure while running, and partial write.

The original log was not deleted or overwritten; ACLs, system security settings, the Node installation, business code, database, UI and reminder tasks were not modified, and logging was not redirected to another directory. When file logging is unavailable, this session's output exists only in the launch window and is not back-filled after closing; environments with write permission continue appending normally.

## Automated tests

`npm test`: **41 pass, 0 fail, 0 skipped**, about 8.52 seconds. All original 37 pass, and 4 new startup-log regressions pass. Raw results are in this round's terminal tool records; no additional broad audit was re-run.

## Real run and page smoke tests

Launched with `start.bat` from the project root on port 60459, with the data directory `TEMP/project-desk-startup-smoke-867307937f8143b59bf370ca8dc40d09` created for the purpose. The production database was not used for acceptance. A dedicated acceptance tab in the existing Chrome was used; actual pages and screenshots were checked within this round's tool records, with no new screenshot files added and no references to non-existent image paths.

| Check | Actual result |
| --- | --- |
| Startup while the original log still returns EPERM | Pass: one clear message, service and console logging work normally |
| Overview | Displays correctly; 1 project, 1 in progress, 37% project, 1 log and 1 note interlinked correctly |
| Project Archive / Project Detail | Open correctly; category/status/ring and detail areas show no obvious layout anomalies |
| Revisit Center | Opens correctly, showing nothing currently due; rules and system tasks unchanged |
| Digital Resources / material detail | Open correctly; text saved successfully and mutually associated with the project |
| Follow-up Center | Opens correctly, showing the same development log |
| Settings | Opens correctly, showing the correct isolated database path, v1.0.0 and schema 007 |
| Light / Dark / Follow System | Top-bar options, direct compact-slider clicks, settings form save, expand/collapse all work; top-bar switching synchronises the form |
| Theme persistence on refresh | Follow System persists after refresh; DOM mode=system, effective=dark, consistent with the current systemDark=true. OS appearance was not changed to simulate system switching |
| Browser errors | The error log captured by this acceptance tab is empty |
| stop.bat → start.bat cold start | Pass: clean shutdown after identity verification, then successful launch from the root; projects, logs, materials, categories, participants/associations, memos and theme snapshots fully consistent |
| Final normal shutdown | Second `stop.bat` exit code 0, service launch session exit code 0; 60459 returned ECONNREFUSED |

Tests created only 1 project, 1 log and 1 text material in an isolated database. The acceptance tab was closed without affecting other user windows; after confirming the service stopped, the absolute path was verified to be inside TEMP with an exact name match before cleaning this round's data directory. Historical output, audit copies, screenshots and reports were not deleted.

## Protection checks and conclusion

The aggregate SHA-256 of paths and content for **65 files** across `server/`, `public/` and production `data/` is identical before and after the fix:

`c2cd285eb88612f6d9ed6ce6b723923bfd0c781f571d8e1f8fac47c35ece626a`

The original `logs/server.log` digest is identical before and after:

`c462023352ee09dd2ca8a56e7988403ce0777b4438e385a70d5aea7911ab099e`

There were no business/UI regressions or new confirmed Critical / High blockers this round; the main page, theme and normal cold-start smoke tests previously missing due to the log open failure are now complete. Per the Phase 8.3 user arrangement, documentation is updated to **v1.0.0 — Released / Stable**, retaining existing untested boundaries such as real Windows shutdown notifications and the second physical disk. The historical phase copy on the About page was not modified, respecting the no-UI-change scope.
