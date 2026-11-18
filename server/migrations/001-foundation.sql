-- Phase 0: small, empty core. Later modules add their own versioned migrations.
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','in_progress','paused','completed','abandoned')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  folder_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  content TEXT NOT NULL CHECK(length(trim(content)) > 0),
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX journal_project_date ON journal_entries(project_id, occurred_at);
CREATE TABLE resources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  kind TEXT NOT NULL CHECK(kind IN ('web','video_link','image','video','text','file')),
  source_url TEXT,
  content TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE project_resources (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  PRIMARY KEY(project_id, resource_id)
) STRICT;
-- Files are separate from resource records; removing an association never deletes a disk file.
CREATE TABLE file_assets (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  storage_mode TEXT NOT NULL CHECK(storage_mode IN ('managed','reference')),
  path TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;
