# PROJECT DESK

[![Node.js](https://img.shields.io/badge/Node.js-24.x-3c873a)](https://nodejs.org/en/download)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078d4)](#requirements)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

A local-first project management and digital archive app for Windows. Projects, progress, development logs, files, reminders and follow-ups live in one workbench. Everything is stored on your own machine — no accounts, no cloud services, no telemetry.

**English** · [简体中文](README.zh-CN.md)

---

## Requirements

- **Node.js 24.x** (Windows x64) — install it yourself from [nodejs.org](https://nodejs.org/en/download).
- No other runtime dependencies. `npm install` is **not** required.
- The app never installs or upgrades Node.js on your behalf.

## Getting started

```bash
# 1. Install Node.js 24.x, then from the project folder:
start.bat            # Windows: launches service + opens the browser
npm start            # or run it from a terminal
```

The workbench opens at <http://127.0.0.1:4317>. Stop the service with `stop.bat` (or `npm run serve` — see scripts below). Closing the browser tab does **not** stop the service.

| Script | Purpose |
| --- | --- |
| `npm start` | Launch service, open browser, append log to `logs/server.log` |
| `npm run serve` | Start the HTTP server only |
| `npm test` | Run the isolated automated test suite |

## Features

- **Workbench** — overview, project archive, follow-up center, digital library, settings; full browser history support.
- **Appearance** — light, dark and follow-system themes persisted in SQLite; design tokens for color, type and spacing.
- **Projects** — CRUD, five statuses, 0–100 integer progress with ring visualisation, custom categories with icons, favourites, manual ordering, archive and restore, per-page filtering and sorting.
- **Development log** — participants, two-level project/log association, milestones, date and participant filters, current-work notes.
- **Digital library** — videos, images, web pages, text and attachments; labels, collection folders, project cross-references; batch import, storage directory management, recycle bin.
- **Reminders** — per-category and per-item follow-up cycles, Windows toast notifications via a scheduled task, no network access required.
- **Backup & restore** — versioned packages with manifest, checksums and integrity verification; interrupted restores recover safely.
- **Search & insight** — global search (`Ctrl+K`), usage statistics, reusable presets, quick actions.

## Data and backup

The SQLite database and its WAL/SHM files are accessed by the backend only and are never exposed through static routes. Data defaults to the project's `data/` directory; set `PROJECT_DESK_DATA_DIR` **before** launch to use another local directory (changing it does not migrate existing data). Uploaded files are stored separately under `assets/` inside that directory, not inside SQLite.

For backups, use **Settings → Backup & Restore**: it packages the database, managed files and a manifest together. For a manual cold backup, stop the service first and copy the entire data directory (plus any custom managed directories). Never copy or replace the SQLite file while the service is running.

## Project layout

```text
PROJECT-DESK/
  start.bat / stop.bat        Windows launchers
  package.json                scripts and Node.js engine requirement
  public/                     workbench shell, pages, UI components, styles
    index.html, app.js        shell and routing
    pages/                    overview, projects, detail, categories, modals
    ui/                       shared components, icons, progress ring
    services/api.js           HTTP data access
    styles/                   design tokens, layout, responsive rules
  server/                     local HTTP service and API
    index.mjs                 server entry
    database.mjs              SQLite connection and migrations
    projects.mjs              projects and categories
    development.mjs           participants, logs, current work
    library.mjs, assets.mjs   library records, streaming upload, range preview
    storage.mjs, backups.mjs  storage operations, backup and restore
    reminders.mjs, search.mjs, usage.mjs, presets.mjs
    migrations/               ordered SQL migrations
  scripts/                    launcher, log handling, reminder tooling
  tests/                      isolated database and HTTP checks
  docs/                       architecture, data model, phase reports
  data/  logs/                local runtime data (git-ignored)
```

## Status

**v1.0.0** — 41/41 automated tests passing. The application is a local browser workbench; no desktop wrapper yet. Scheduled automatic backups and model API integration are not implemented.

Design and engineering notes live in [`docs/`](docs): [`ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`DATA.md`](docs/DATA.md), [`PROGRESS.md`](docs/PROGRESS.md), [`FINAL_RELEASE.md`](docs/FINAL_RELEASE.md).

## License

[MIT](LICENSE) © 2026 PROJECT DESK contributors
