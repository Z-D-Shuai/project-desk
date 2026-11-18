# PROJECT DESK — Release Issue Register

## Phase 8.2 fix addendum (2026-11-18)

The current version is a **v1.0.0 pre-release candidate**. The original review below retains its evidence and conclusions at the time; wording such as "not fixed / not in fix scope" reflects that historical point. Current delivery is governed by this addendum, `PROJECT_STATUS.md` and `PHASE82_REPORT.md`.

| ID | Current handling | Verification boundary |
| --- | --- | --- |
| R01 | Empty responses and double-response handling fixed | Empty-file GET/HEAD/Range, subsequent service operation and original project records pass automated regression |
| R02 | Persistent switch marker and startup verification added; unrecognised legacy leftovers block empty-database creation | Five isolated disk states plus normal backup/restore pass; not a real power-loss test |
| R03 | Recycle relocation synchronises original project paths and preserves new occupants | Multi-project, nested path, post-relocation file and original-location content pass regression |
| R04 | Current disk content verified before reuse | Global deduplication and targeted material-file replacement pass regression; genuine duplicates are still reused |
| R05 | Version and database path checked before reuse | Same-workspace reuse passes; wrong workspace/old version refused with the original service surviving |
| R06 | Independent SQLite mutual exclusion, legacy PID lock compatible, empty locks recoverable | New/old empty locks, live holders, same-process contention, cross-process release and no replay of exceptions all pass |
| R07 | Top-bar/settings form synchronisation and draft protection implemented | Three-mode unit and page rendering pass; real slider/form browser retest was blocked by permissions and is not complete |
| R08 | Current version, health/bootstrap display and current usage docs unified | Version settings page rendering and all JS syntax checks pass; historical phase/audit evidence keeps its versions |

Final result: **37 tests pass, 0 failures**; the production SQLite/WAL/SHM fingerprint matches the pre-phase state. Real start/reuse/stop passes and the copy on port 49393 was stopped. The real browser, cold restart and production-copy integrity check each hit permission limits, so those items were stopped and recorded as unverified. U01–U06 remain open with no speculative fixes added. **Ready for final acceptance, but release cannot yet be declared.**

---

The following is the original review from before the fixes.

Compiled: 2026-11-18 (Asia/Shanghai)
Current version: v0.7.2; target version: v1.0.0.

This round only re-reviewed existing documents, the 2026-11-17 audit records and screenshots, and added this file. No service was started, no tests executed, no database fingerprints recomputed, no business code/database/configuration modified and no test copies cleaned. "Confirmed" below means existing evidence has been reproduced at some point — it does not mean it was re-tested or fixed in this round.

Conclusion: **suitable for entering a clearly scoped final fix phase; releasing v1.0.0 directly is not advisable at this point.** Existing evidence confirms 7 functional defects (5 High, 2 Medium), plus Low-severity version/documentation inconsistencies. There is insufficient evidence to confirm any Critical defect, and no evidence that unrecoverable production user data loss has occurred.

## 1. Evidence basis

Primary sources:

- [Supplementary experiment results](<D:/桌面文件/集合/PROJECT DESK/output/final-audit-20261117/supplemental-results.json>), [zero-byte file read log](<D:/桌面文件/集合/PROJECT DESK/output/final-audit-20261117/zero-byte-service.log>), [restore interruption marker log](<D:/桌面文件/集合/PROJECT DESK/output/final-audit-20261117/restore-crash.log>).
- [Launch copy records](<D:/桌面文件/集合/PROJECT DESK/output/final-audit-20261117/runtime.json>), [browser results summary](<D:/桌面文件/集合/PROJECT DESK/output/final-audit-20261117/browser-results-summary.json>) and the original `.log` files and test scripts retained in the same directory.
- [Production database closing check](<D:/桌面文件/集合/PROJECT DESK/output/final-audit-20261117/formal-final-check.json>), [service closure records](<D:/桌面文件/集合/PROJECT DESK/output/final-audit-20261117/closure-service.json>), [browser closure records](<D:/桌面文件/集合/PROJECT DESK/output/final-audit-20261117/closure-browser.json>), [Windows environment records](<D:/桌面文件/集合/PROJECT DESK/output/final-audit-20261117/windows-environment.json>).
- [Audit screenshot directory](<D:/桌面文件/集合/PROJECT DESK/output/playwright/final-audit>), [README](<D:/桌面文件/集合/PROJECT DESK/README.md>), [data documentation](<D:/桌面文件/集合/PROJECT DESK/docs/DATA.md>), [architecture documentation](<D:/桌面文件/集合/PROJECT DESK/docs/ARCHITECTURE.md>), [phase progress](<D:/桌面文件/集合/PROJECT DESK/docs/PROGRESS.md>) and the [Phase 7.2 report](<D:/桌面文件/集合/PROJECT DESK/docs/PHASE72_REPORT.md>).

Evidence boundaries:

1. [Existing automated test log](<D:/桌面文件/集合/PROJECT DESK/output/final-audit-20261117/existing-tests.log>) records 22 passes and 0 failures; supplementary boundary cases still have explicit failures — the two are not contradictory.
2. Normal backup/inspect/restore browser cases pass, recording 4 projects, 8 materials, 3 managed files and successful image re-decoding after restore; this cannot cover the interrupted-restore scenario.
3. The production database closing check ran at 2026-11-17 20:10 (Beijing time): the pre-audit fingerprint exists and 76 protected files match the manifest, including production SQLite, WAL and SHM; the stably copied database has 34 tables, `integrity_check=ok`, 0 foreign key anomalies, 1 valid project and 0 materials. This is evidence from two existing checkpoints, not a new verification of the state on 2026-11-18.
4. A media combination case once errored on a 110-byte WebM sample with no valid video frame; the [follow-up valid sample record](<D:/桌面文件/集合/PROJECT DESK/output/final-audit-20261117/video-valid.log>) shows a 1355-byte sample decoded and played. The first error does not imply all local videos are broken, nor does the later successful playback mean the whole combination case passed.
5. `browser-audit.log` only records a script file not found, a failure in check-script preparation, and is not listed as a product defect. Sub-steps not reached remain marked as not fully verified.
6. No `docs/FINAL_AUDIT_REPORT.md` was found this round, so this file is a release issue list and does not substitute for the full formal audit report that has yet to be produced.

## 2. Confirmed issues and release decisions

| ID | Issue | Confirmation | Priority | v1.0.0 recommendation |
| --- | --- | --- | --- | --- |
| R01 | Reading a 0-byte referenced file exits the local service | Reproduced on an isolated copy | High | Must fix |
| R02 | After an interrupted full-database restore switch, reopening yields a blank database | Controlled interruption reproduced; old database and safety backup still present | High | Must fix |
| R03 | After restoring a folder to a new path, projects still reference the old path | Reproduced on an isolated copy | High | Must fix |
| R04 | Deduplication wrongly reuses content after a managed file is modified externally | Reproduced on an isolated copy | High | Must fix |
| R05 | Starting a different data directory on the same port reuses the wrong workspace | Reproduced on a launch copy | High | Must fix |
| R06 | A leftover empty lock file cannot recover by itself | Reproduced given an empty lock | Medium | Recommended for this final fix round |
| R07 | After switching the theme in the top bar, the settings form still shows the old value | Confirmed by browser test and screenshot | Medium | Recommended for this final fix round |
| R08 | Version information and some usage instructions are inconsistent | Confirmed from existing docs and source text | Low | Unify during release preparation; does not block starting fixes |

### R01 · Reading a 0-byte referenced file exits the service

- **Location:** `serveAsset` in `server/assets.mjs`; response error handling in `server/index.mjs`.
- **Evidence:** supplementary result `zero-byte-reference-http-service` and the zero-byte read log: the file was referenced normally, then became 0 bytes during the test; the request failed and the service child process exited with code 1. The log shows `ERR_OUT_OF_RANGE` from the read stream with `end=-1`, followed by `ERR_HTTP_HEADERS_SENT`.
- **Confirmed scope:** this read scenario is confirmed to exit the test service; there is no evidence the production database was damaged. It must not be generalised to all missing files or all attachments causing exits.
- **Everyday impact:** if a referenced file is truncated by an external program, previewing or downloading it may take down the whole workbench service, requiring a restart.
- **Decision:** High, must fix for v1.0.0.
- **Recommended approach:** handle empty files before writing response headers and creating the read stream; make the error handler distinguish whether headers were already sent to avoid sending a JSON response twice. Add a small regression for empty-file GET, HEAD and Range afterwards.

### R02 · Interrupted full-database restore starts as a blank workbench

- **Location:** the database replacement step in `server/backups.mjs`; open/create logic in `server/database.mjs`.
- **Evidence:** `restore-crash-between-database-renames` records a controlled interruption after the old database was renamed but before the switch completed; the primary database file did not exist before reopening and the project count was 0 afterwards; the old database, staged database and pre-restore safety backup were all retained.
- **Confirmed scope:** it is confirmed that this specific restore switch point neither auto-recovers nor explicitly blocks empty-database creation; no full-machine power loss was tested and permanent deletion of old bytes is not proven. Normally completed restores already have passing records.
- **Everyday impact:** after an abnormal exit during restore, users may believe all records are lost and keep using the new empty database; recovering the old data then requires extra work.
- **Decision:** High, must fix for v1.0.0.
- **Recommended approach:** record a recoverable database switch state; on startup detect an unfinished restore and, after verifying the old/candidate databases, restore or explicitly block creating an empty workspace. Keep the safety backup and never auto-overwrite uncertain content.

### R03 · Project paths not synchronised after restoring a folder

- **Location:** `restoreTrash` and the path-change plan in `server/storage.mjs`.
- **Evidence:** `project-folder-alternate-recycle-restore`: after recycling a project directory, the original location was occupied by other content; restoring to `restored` was chosen. The file `PROJECT-WORK` was restored at the new location, but the project's `folder_path` still pointed at `original`, which contained unrelated content.
- **Confirmed scope:** the project association inconsistency when restoring to a different path is confirmed; loss of files at the new location or failure of all ordinary moves is not proven.
- **Everyday impact:** opening the directory from the project may land in the old location, so the restored working files cannot be reached directly.
- **Decision:** High, must fix for v1.0.0.
- **Recommended approach:** when a restore changes location, update affected projects and directory-prefix associations consistently with the file registration changes; preserve other content at the original location and never overwrite same-named files.

### R04 · Deduplication misreuse after external modification

- **Location:** duplicate-content detection in `attachFile` in `server/storage.mjs`.
- **Evidence:** `managed-dedup-after-external-edit`: source content was `CONTENT-A`, the ingested copy was then changed externally to `CONTENT-B`; re-importing the source file returned `duplicate=true` while the actual associated content remained B, and source file A still existed.
- **Confirmed scope:** misreuse under these conditions is confirmed; no large number of duplicate records was found, and deletion of the original source file is not proven. Existing normal same-content deduplication tests pass.
- **Everyday impact:** the content the user believes was copied in differs from what the material actually opens.
- **Decision:** High, must fix for v1.0.0.
- **Recommended approach:** verify a candidate file's current content matches the imported content before reuse; refresh the registration or refuse reuse when the digest is stale, with a clear content-changed notice. Never judge duplication from an old digest plus file existence alone.

### R05 · Insufficient workspace identity on startup

- **Location:** existing-service probing in `scripts/launch.mjs`.
- **Evidence:** `differentDataStart` in `runtime.json`: a service for data directory A was running on 50608; starting the same port with directory B reported an existing service, but the actual database was still A rather than the expected B. Repeated launches of the same directory have separate passing records.
- **Confirmed scope:** wrong reuse when multiple data directories share a port is confirmed; there is no evidence that production data was written incorrectly during the experiment.
- **Everyday impact:** switching personal data directories may land in another workspace, creating a risk of misoperation.
- **Decision:** High, must fix for v1.0.0.
- **Recommended approach:** verify both application identity and the normalised database path before reusing a service; on mismatch, report a port conflict/different workspace clearly and never terminate the other service automatically.

### R06 · Empty lock file blocks operations persistently

- **Location:** `withDataLock` in `server/data-lock.mjs`.
- **Evidence:** `empty-abandoned-data-lock`: an empty lock file pre-existed in an isolated test directory; the call returned "another data check or restore is running" after about 10905 ms, and the empty lock remained.
- **Confirmed scope:** inability to self-recover when an empty lock exists is confirmed; the experiment does not prove a real abnormal exit always produces an empty lock, nor that ordinary project CRUD would be equally blocked.
- **Everyday impact:** once such a leftover exists, data checks, backups or restores relying on that lock may fail repeatedly.
- **Decision:** Medium, recommended in the same batch for v1.0.0.
- **Recommended approach:** improve lock initialisation and abnormal-state detection, providing explainable occupancy diagnostics and a safe recovery path; never simply ignore the lock or unconditionally delete one with a live holder.

### R07 · Settings form out of sync with the actual theme

- **Location:** theme state synchronisation in `public/ui/studio.js`; theme form in `public/pages/settings.js`.
- **Evidence:** `theme-settings-stale-selection`: after switching in the top bar the SQLite value was `dark` while the form still showed `light`; saving the form returned SQLite to `light`; the [screenshot](<D:/桌面文件/集合/PROJECT DESK/output/playwright/final-audit/theme-setting-mismatch.png>) shows "light" still selected on a dark page.
- **Confirmed scope:** the two theme entry points on the same page being out of sync is confirmed. Follow System's light/dark system simulation switching passed in the same record, so its overall failure cannot be concluded.
- **Everyday impact:** the selected value shown to the user contradicts the actual theme, and saving may inadvertently revert the switch just made.
- **Decision:** Medium, recommended before v1.0.0.
- **Recommended approach:** update theme state and visible controls together; handle conflicts for unsaved form selections explicitly so old values cannot silently overwrite new settings.

### R08 · Version and documentation wording not unified

- **Location:** the settings "About" page, README and phase status descriptions.
- **Evidence:** the current state is v0.7.2 while the settings page still says `v0.7.0 · phase 7`; the README's early section says at most 5 recent projects while a later section says 1–12 are selectable; the historical restore section still says "only 005 is currently supported" while a later section says 005/006/007. No formal audit report was found this round.
- **Confirmed scope:** text and delivery materials have not converged; it is not proven that backups only support 005 or that recent projects can only show 5.
- **Everyday impact:** users may misjudge the version, restore scope or whether acceptance is complete, and successors may repeat the omissions.
- **Decision:** Low, recommended during final release preparation; does not block starting the functional fixes.
- **Recommended approach:** unify the version source, separate historical phase descriptions from current usage guidance, and complete the formal acceptance conclusion. Keep the original audit evidence and do not treat this list as proof of release acceptance.

## 3. Known limitations that can be handled later

These are documented capability boundaries, not new data-loss faults, and are not counted among the 7 functional defects above.

| Item | Evidence and impact | Priority | v1.0.0 recommendation and follow-up |
| --- | --- | --- | --- |
| Browser UI preferences do not migrate with database backups | DATA and README state that card/list mode, pinning and recent count live in `localStorage`; changing browsers may reset them, without losing business data | Low | Preference export can be added later; for v1, clear documentation suffices |
| Search and browsing target personal data scale | Architecture documents local LIKE, at most 50 results per type, and in-browser filtering after reading the collection; no existing evidence shows performance faults at current scale | Low | Evaluate pagination or FTS as data grows; do not force an architecture migration for this release |
| Statistics may lose the final slice on abnormal exit | README describes a ~15-second heartbeat and retries of only the last two minutes; no new evidence shows development records changing because of it | Low | v1 discloses the timing model; higher-precision statistics can come later |
| Media depends on browser codec support | Valid VP8/WebM has passing playback records, which does not mean every MP4 or codec plays | Low | v1 documents supported ranges and download options; no need to introduce transcoding dependencies for release |

R08 can be handled during release preparation after the functional fixes; the known limitations above can wait for later versions.

## 4. Open questions and verification gaps

Priorities below indicate confirmation order and do not mean a product defect of that severity has been confirmed. No additional testing was done this round.

| ID | Item and existing evidence | Current judgement | Confirmation priority | v1.0.0 recommendation |
| --- | --- | --- | --- | --- |
| U01 | Windows environment records show no PROJECT DESK task and system notifications enabled at the time; Phase 5 historical reports have successful notification/task records, but no evidence of catch-up after an actual machine reboot | An empty task list is a configuration state and not directly a fault; catch-up after a missed shutdown and the full notification-click chain in the current version remain unconfirmed | High | Before final release, run bounded routine acceptance in an environment the user explicitly arranges, and disclose unverified parts honestly |
| U02 | C→D file moves and digest verification passed; environment records show C/D/E all on Disk 0 | Moves to a second physical disk are unverified; cross-volume results are not a substitute | Medium | Verify once hardware is available; meanwhile state the verification scope clearly and do not guess that cross-disk moves fail |
| U03 | Long-running operation, large data volumes, the 512 MiB boundary and all media codecs have no complete long-term test material | Unconfirmed, not listed as a discovered fault | Medium | Schedule limited acceptance within the actual usage scope; do not expand checks this round |
| U04 | The [390px long-title screenshot](<D:/桌面文件/集合/PROJECT DESK/output/playwright/final-audit/long-title-390.png>) appears to show the title overlapping the quick-action area; the original log only confirms no horizontal overflow | Visual concern unconfirmed; `long-title-boundary=PASS` is insufficient to prove no overlap or to identify the layout cause | Medium | Later, check only that boundary interaction and decide on a fix after confirmation |
| U05 | The media combination case stopped at the video step; a separate retest with a valid WebM passed; the attachment UI sub-step in that combination was not completed | The whole combination cannot be written as passed, nor can the attachment feature be declared broken; existing automated upload/attachment checks pass | Medium | Final acceptance only needs to complete the missing ordinary steps |
| U06 | Existing closure records: identity verification and clean shutdown on 50608 succeeded; the browser tool listed no session, PID verification returned access denied, and closure was unconfirmed | Browser closure state is not finally confirmed — an acceptance process-state gap, not directly a product defect | Low | Complete or record it via an ordinary method with confirmable identity; stop on restrictions without affecting other windows. No process re-verification was done this round |

## 5. Release judgement

### Must be handled for v1.0.0

- R01–R05: prioritise file-read exit, interrupted restore, restore path association, wrong deduplication reuse and workspace identity on startup.
- R06–R07: recommend handling abnormal lock recovery and theme control synchronisation in the same batch so confirmed reliability issues do not reach the formal release.
- R08: unify the version and current documentation after the functional fixes and before release, forming a clear final acceptance conclusion.

### Can be handled later

Browser preference migration, large-scale search/pagination, statistics precision and support for more media codecs. Existing evidence does not support escalating them into current blockers.

### Open

U01–U06 remain open. In particular, distinguish real Windows reboot catch-up from simulated time checks, cross-volume from cross-physical-disk, and "no horizontal overflow" from "no visual overlap". Without sufficient evidence, do not prescribe unconfirmed fix approaches.

### Is it appropriate to enter the final fix phase now?

**Yes.** Existing evidence is sufficient to scope fixes for R01–R07 without another broad audit first. Fixes must be scheduled separately by the user, then checked against the existing 22 tests and corresponding small regressions. **It is not appropriate to declare v1.0.0 releasable at this point.** This round did not enter the fix phase; existing source, production data, configuration, logs and test copies are unmodified.
