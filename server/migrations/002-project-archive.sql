CREATE TABLE project_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 40),
  icon TEXT NOT NULL DEFAULT 'folder' CHECK(length(icon) BETWEEN 1 AND 24),
  favorite INTEGER NOT NULL DEFAULT 0 CHECK(favorite IN (0,1)),
  sort_order INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE UNIQUE INDEX project_category_name ON project_categories(name COLLATE NOCASE);
ALTER TABLE projects ADD COLUMN category_id TEXT REFERENCES project_categories(id) ON DELETE RESTRICT;
ALTER TABLE projects ADD COLUMN archived_at TEXT;
ALTER TABLE projects ADD COLUMN deleted_at TEXT;
ALTER TABLE projects ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
CREATE INDEX project_category ON projects(category_id);
CREATE INDEX project_visibility_updated ON projects(deleted_at, archived_at, updated_at DESC);
