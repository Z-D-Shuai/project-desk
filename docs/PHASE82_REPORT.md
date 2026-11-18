# PROJECT DESK — Phase 8.2 Fix Report

Date: 2026-11-18 (Asia/Shanghai). Current version **v1.0.0 release candidate**, schema **007**. The specified fixes are complete, awaiting final acceptance; not yet formally released.

## Scope and conclusion

The confirmed High R01–R05 and Medium R06–R07 items in `RELEASE_ISSUES.md` were fixed one by one, and R08 version/current documentation unified. No business features added, no technology stack change, no new runtime dependencies, no Git usage and no Windows reminder task changes. Existing projects, materials, logs, statistics, search, presets, UI and file management are retained.

**Final result: 37 automated tests pass, 0 failures; 86 JS/MJS files pass syntax checks.** A real isolated service passed one-click launch, repeated reuse, three-mode theme API read-back and normal shutdown. Production SQLite/WAL/SHM digests match before and after.

**Ready for bounded final acceptance, but this does not permit declaring a formal release.** The real browser, runtime-copy cold restart and production-copy integrity check were blocked by permission limits this round; those checks were stopped without changing target directories, altering configuration, elevating or switching browsers. Existing unverified items still need explicit acceptance or completion at final acceptance.

## Fix details

| Issue | Main location | Change and verification |
| --- | --- | --- |
| R01 empty file read exit (High) | server/assets.mjs, server/index.mjs | 0-byte GET/HEAD ends immediately, Range returns 416; no second JSON response after headers are sent. Tests confirm health and original project progress are still readable. |
| R02 interrupted restore creates empty database (High) | server/restore-state.mjs, database.mjs, backups.mjs | State marker written exclusively and fsynced before the primary database is renamed, storing old/candidate SHA-256. Before creating a database, the clearly matching one is restored and integrity/foreign keys/migration records verified. Unknown markers, mismatched digests or legacy marker-less leftovers refuse to create/overwrite, keeping the safety backup. |
| R03 restore paths not synchronised (High) | server/storage.mjs | Recycle payload stores original project IDs; relocation restore synchronises original project paths with file registrations in one transaction, supporting shared/nested paths. Projects newly associated with the old location are not rewritten and unrelated files are not overwritten. Legacy payloads remain compatible. |
| R04 deduplication misreuse (High) | server/storage.mjs | Global material reuse and same-directory file reuse both verify actual on-disk digest/size first; changed metadata is refreshed and wrong candidates are not reused. Both the source file and the externally modified copy are kept, and genuine duplicates are still reused. |
| R05 startup uses wrong workspace (High) | scripts/launch.mjs | Before reuse, app identity, version and actual `databasePath` are verified; other workspaces or older versions are refused, the original instance is neither opened nor closed, and no database is created in the wrong target directory. |
| R06 empty lock unrecoverable (Medium) | server/data-lock.mjs | An independent SQLite exclusive transaction holds mutual exclusion during the primary database switch; the legacy PID lock stays compatible, an empty lock can be taken over after an initialisation window, and leftover metadata is preserved separately. Live holders are respected and a business busy exception is executed only once. |
| R07 stale theme form value (Medium) | public/ui/studio.js | The form is force-synchronised on top-bar save success/failure; passive system appearance changes preserve unsaved drafts. Original day/night drawing and CSS unchanged. Three modes, selection state/labels and draft unit tests pass; real-browser verification pending. |
| R08 version/documentation (Low) | package.json, server/version.mjs, health/bootstrap, workbench/settings and docs | Current version unified to 1.0.0; the service version is read from package.json while the schema stays 007; corrected current statements about recent-item count, backup compatibility and slider position. Original versions in historical reports and evidence are preserved. |

R02 automated tests construct five independent disk states: prepared, previous-moved, candidate-installed, staged-only and legacy-gap; no interruption was performed against production and constructed states are not treated as a real shutdown/power-loss pass. For the legacy marker-less scenario the app refuses to start with an empty database, requiring the old database and `recovery` to be kept for manual confirmation rather than guessing which workbench version is needed.

## Tests actually executed

- `npm test` final: **37 pass / 0 fail / 0 skipped**, about 8.38 seconds. All original 22 pass, with 15 new cases including subtests. Full record in `output/phase82/tests-release.log`, saved from two raw terminal output segments; earlier 32/36 logs are also retained.
- Existing regressions cover project CRUD/status/categories/progress/archive, participants/two-level association/logs/memos, materials/tags/collections, shared files/paths/recycle, full backup and restore, 005/006 backup migration to 007, reminder calculation/deduplication/repeat, statistics independence, preset history and global search. All run against test-created data.
- New `tests/release-fixes.test.mjs` covers the seven fixes above, normal cross-process mutual exclusion and old-version service reuse refusal; actual module rendering of the settings page verifies the version and the selected state for all three saves.
- `node --check` across **86 JS/MJS files** in public/server/scripts/tests: 0 syntax errors. During wrap-up a new version string misused template quotes; it was fixed and a settings-page rendering regression added, after which the full suite passed. This was corrected within this change set and is not an unresolved product defect.
- `output/phase82/runtime/` is an independent runtime copy containing only self-created acceptance projects, participants, logs, memos and text materials. Its bootstrap data path and 1.0.0 identity were verified; real `start.bat`, repeated `start.bat` reuse, light/dark/system save and read-back, and `stop.bat` normal shutdown all pass. Afterwards the 49393 health endpoint returned **ECONNREFUSED**.
- The runtime copy was created before the final "About" copy syntax fix, so its launch/API results cover the backend and launch scripts, not a real browser pass of the final frontend. Final frontend verification is limited to syntax/rendering tests. The copy is retained as evidence, not as a production usage directory.

## Incomplete verification and limitations

| Item | Actual result | Follow-up scope |
| --- | --- | --- |
| Current UI / theme / slider browser regression | Playwright hit EPERM writing the daemon file phase82.err and never reached a page; item stopped | Final acceptance should check top-bar switch → settings value, reverse save, Follow System drafts and slider click/drag/expand; old screenshots must not substitute for a current pass |
| Persistence after real cold restart | Normal `stop.bat` completed, then opening runtime.log returned EPERM and no new service started; item stopped | Automated reopen/backup-restore persistence passes, but the one-click cold restart on-device loop remains to be verified this round |
| Production copy integrity | Creating the `formal-after-copy` directory returned WinError 5, the production SQLite was never opened, item stopped | In a permissive environment, stably copy SQLite/WAL and run integrity_check / foreign_key_check on the copy; this round's production integrity cannot be claimed as actually passing |
| Windows notifications, catch-up after a real missed shutdown, notification-click targeting | No task reinstall, production settings change or system notification sent this round | U01 remains open; passing reminder rules do not substitute for the system notification chain |
| Second physical disk, long-term/large-scale/512 MiB, 390px long title and media UI gaps, legacy browser closure | Carried over from U02–U06, not expanded this round | Verify within scope or explicitly accept the limits; do not guess faults from suspicions |

Saving the script's `runtime-result.json` also hit EPERM and was not retried; the observations were instead written to `verification-result.json` with the normal file editing tool. `runtime.log` is 0 bytes and is not treated as a success log. An initial text-material test fixture omitted the `favorite` field and was correctly rejected by the API; the fixture was then fixed — not a product fault. The permission errors above are observed local tool/file access limits, with no evidence attributing them to business code and no claim that an automated review rejected them.

No confirmed business issue requiring further fixes was found. R07's real-browser loop remains unaccepted, and other unverified items are not counted as passes.

## Production data and recovery provisions

Pre-phase source and data snapshot: `backups/before-phase82-20261118-134714.zip`; the pre-phase fingerprint `output/phase82/before.json` is available. At phase end, read-only recomputation of production `data` file digests showed **all three files matching, with no additions or deletions**:

| File | SHA-256 (identical before and after the phase) |
| --- | --- |
| project-desk.sqlite | cf0eee8909098974ff98914b6eb1b8ac9c1468224d01bee7e5e7ea0de23ea707 |
| project-desk.sqlite-wal | 721aacfc18ba7f8b1b97243f069d25d74cb5fc1fd33852f9a01a7ceb58c0edbd |
| project-desk.sqlite-shm | 70797f20b167967566946b95905dcb5c43bf32f4552d5193adc9690691dea1f3 |

The production database bytes therefore match the baseline at phase end — original projects, materials, logs and settings were not rewritten by this round's tests. This is not a claim of zero change at every intermediate moment. The new-copy integrity recheck was not completed, so the earlier audit's `integrity_check=ok` cannot be reported as a new result for this round.

Migration files, all CSS and the original `day-night.js` — 18 files — match the baseline. No production database connection, new migration, production sample records, real user file changes or Windows task modifications. The auxiliary mutex is actually created only in test data directories; normal operation creates it in whichever data directory is used, and it is not part of the business schema.

All previous audit logs, screenshots and test copies are retained; this phase retains the snapshot, `before.json`, `tests-first.log`, `tests-final.log`, `tests-release.log`, `verification-result.json`, the runtime copy/scripts and the empty `runtime.log`. Output was not cleaned and no other browser windows were closed. The browser did not start successfully this round, so the legacy audit's browser-closure concern remains U06.

## Usage and handover

Production use is still the root **start.bat**; default `http://127.0.0.1:4317`; **stop.bat** stops the service without uninstalling independent reminders. Stop the old instance before updating — the new version refuses to reuse an older version or a different data path; with custom data directories/ports use the same environment variables for start and stop. No `npm install` needed.

Verification command: `npm test`. Tests create isolated temporary data; do not treat audit/runtime copies under output as a production workspace. When the explicit legacy-restore-residue warning appears, keep the old database, candidate database and safety backup, then have the user schedule a controlled restore.

PROJECT_STATUS, README, PROGRESS, DATA, ARCHITECTURE, UI_DESIGN_SYSTEM and the RELEASE_ISSUES addendum were updated. **Phase 8.2 stops here, awaiting user-scheduled final acceptance.** This report does not substitute for the not-yet-produced full FINAL_AUDIT_REPORT, and no new full audit or release action was performed.
