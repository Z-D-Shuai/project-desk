# PROJECT DESK — Final Release Acceptance

Date: 2026-11-18. **Final smoke testing is complete after the startup log fix; the current state is Released / Stable.** The initial blocked record is retained in the historical validation section and no longer represents a current blocker.

## Version

**v1.0.0 — Released / Stable.** All main program versions are 1.0.0; the SQLite schema remains 007. No business code or UI was modified.

## Completed

- Project management, categories, status and completion, archiving and overview.
- Custom AI/Agent entries, two-level project/log association, development logs, timelines, current work and the follow-up centre.
- Video, image, web page, text and attachment materials, with categories, tags, collections, previews and multi-project association.
- Local file copy/reference, directory management, shared-content protection, recycle bin, backup verification and restore.
- Revisit centre, reminder rules, independent Windows scheduled checks and notifications.
- Usage statistics, saved presets, global search, quick actions and page interlinking.
- Cream Studio UI, Light / Dark / Follow System and the top-bar day/night slider.

The above lists existing capabilities; it does not mean all were smoke-tested on-device in this round.

## Validation

### Final re-verification results

- **41 automated tests pass, 0 failures, 0 skipped** (the original 37 plus 4 startup-log regressions), about 8.52 seconds.
- Fixed: file log errors no longer block startup. When the log is unwritable the app clearly reports it and keeps window output; it does not change permissions, overwrite old logs or switch directories. **`start.bat` launched twice and `stop.bat` stopped cleanly twice** from the root directory.
- The Chrome acceptance tab actually checked Overview, Project Archive, Project Detail, Revisit Center, Digital Resources, Settings, plus the follow-up centre and material detail; no obvious layout anomalies. Creating temporary projects, logs and text materials, their associations, and overview/list interlinking all passed.
- Light / Dark / Follow System, compact slider clicks, panel expand/collapse, settings synchronisation and persistence across refresh pass; the effective appearance of system dark and follow mode match. The acceptance tab captured `error=[]`.
- After a normal shutdown and cold start, projects, logs, materials, associations and theme snapshots matched. The final port 60459 returned ECONNREFUSED; the acceptance tab was closed and this round's isolated data cleaned up. The business backend, UI, 65 files of production data and the original log fingerprint are unchanged.

See [STARTUP_FIX_REPORT.md](STARTUP_FIX_REPORT.md) for the full root cause, files and verification evidence. Historical screenshots and test copies are retained; this round's screenshots live in tool records with no new screenshot files added.

### Initial blocked record (historical, since re-verified)

This round ran the existing `npm test`: **37 passed, 0 failed, 0 skipped, exit code 0**, about 8.62 seconds. It covered projects, development logs/follow-up, materials, file management, backup/restore, theme state and page rendering, search, statistics, presets and basic reminder functions. Test scope was not expanded. Full output is retained in this session's terminal tool records; creating the `output/phase83` evidence directory was refused, and the files were not re-saved elsewhere.

Running **start.bat** from the root directory with an isolated empty TEMP directory and port 50793 returned **EPERM** when opening `logs/server.log` at `scripts/launch.mjs:23:56`, exiting with code 1; the app was not reached and that attempt was stopped. No elevation, permission change, log path change or alternative launch method was used.

| Smoke item | Result this round |
| --- | --- |
| start.bat from root | Not successful; log file access denied; cause not yet confirmed |
| Overview / Project Archive / Project Detail | Not verified, pages not opened |
| Revisit Center / Digital Resources / Settings | Not verified, pages not opened |
| Current layout and Light / Dark / Follow System | Not verified; unit/rendering regressions do not replace on-device smoke |
| Projects, logs, materials and page interlinking | Automated regressions passed; ordinary page operations not verified this round |

No business test records were created; the single new empty temporary directory was verified to be inside TEMP and then deleted. The last read of 50793 returned ECONNREFUSED, so no service needed stopping. The browser only fetched the environment inventory — no acceptance tab was opened and no other user windows were closed. Production SQLite/WAL/SHM SHA-256 matched before and after; historical output, screenshots, audit records and test copies were not cleaned up.

## Fixed Before Release

Phase 8.2 fixed the following with regression evidence:

1. Reading an empty file crashed the service.
2. An interrupted restore created an empty database by mistake.
3. Restoring a recycled directory to a new location did not update project paths.
4. Deduplication wrongly reused files modified externally.
5. Startup reused the wrong workspace.
6. A leftover empty lock could not be recovered.
7. The top-bar theme and the settings form state were out of sync.

Version strings and current documentation are now unified; see `PHASE82_REPORT.md` for the full fix boundaries.

## Known Limitations

- Full on-device testing of notification catch-up after actual Windows shutdown/logon, and of the complete notification-click chain in the current version, is still outstanding.
- Moving to a second physical disk has not been tested; cross-volume results are not a substitute.
- `localStorage` preferences such as card/list mode, pinning and recent-item count are not included in SQLite backups; the theme itself is stored in SQLite.
- Usage statistics use a ~15-second heartbeat, so an abnormal exit may lose the final slice; search returns at most 50 items per type; media playback depends on browser codec support.
- Long-term large-scale use, all 512 MiB/media boundaries, existing narrow-screen long titles and attachment UI verification gaps remain.
- On-device cold start of the local service was re-verified this round against an isolated database; a fresh integrity check of a copy of production data was not expanded this round, and unchanged business file fingerprints do not substitute for a new check. Phase 8.2 historical evidence is retained as reported.
- The current environment still cannot write the original log, handled by startup fault tolerance; only window output is kept and nothing is back-filled after closing. Normally writable environments still append to the file.

Untested does not mean failed. There are no confirmed Critical / High release blockers; known boundaries remain, and historical blocked records are not treated as current acceptance failures.

## Release Status

**PROJECT DESK v1.0.0 is ready for production use.**

**Release Status: Released / Stable.** The specified fixes, existing regressions, main page/theme smoke tests and normal startup/shutdown are complete, with no new confirmed Critical / High issues. The known limitations above still apply.

Per the authorised Phase 8.3 arrangement, v1.0.0 development ends here; this round stops without adding features, refactoring or starting the next phase.
