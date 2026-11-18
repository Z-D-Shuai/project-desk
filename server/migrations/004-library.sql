CREATE TABLE resource_categories (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT 'folder', sort_order INTEGER NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE UNIQUE INDEX resource_category_name ON resource_categories(name COLLATE NOCASE);
CREATE TABLE resource_tags (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT 'folder', sort_order INTEGER NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE UNIQUE INDEX resource_tag_name ON resource_tags(name COLLATE NOCASE);
CREATE TABLE resource_collections (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT 'folder', sort_order INTEGER NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE UNIQUE INDEX resource_collection_name ON resource_collections(name COLLATE NOCASE);
ALTER TABLE resources ADD COLUMN category_id TEXT REFERENCES resource_categories(id);
ALTER TABLE resources ADD COLUMN platform TEXT NOT NULL DEFAULT '';
ALTER TABLE resources ADD COLUMN notes TEXT NOT NULL DEFAULT '';
ALTER TABLE resources ADD COLUMN status TEXT NOT NULL DEFAULT 'unsorted' CHECK(status IN('unsorted','to_view','learning','learned','used','archived'));
ALTER TABLE resources ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0 CHECK(favorite IN(0,1));
ALTER TABLE resources ADD COLUMN last_viewed_at TEXT;
ALTER TABLE resources ADD COLUMN deleted_at TEXT;
ALTER TABLE resources ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE resources ADD COLUMN asset_id TEXT REFERENCES file_assets(id);
ALTER TABLE file_assets ADD COLUMN original_name TEXT NOT NULL DEFAULT '';
ALTER TABLE file_assets ADD COLUMN mime TEXT NOT NULL DEFAULT 'application/octet-stream';
ALTER TABLE file_assets ADD COLUMN size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE file_assets ADD COLUMN sha256 TEXT;
CREATE TABLE resource_tag_links (
 resource_id TEXT NOT NULL REFERENCES resources(id), tag_id TEXT NOT NULL REFERENCES resource_tags(id), PRIMARY KEY(resource_id,tag_id)
) STRICT;
CREATE TABLE resource_collection_links (
 resource_id TEXT NOT NULL REFERENCES resources(id), collection_id TEXT NOT NULL REFERENCES resource_collections(id), PRIMARY KEY(resource_id,collection_id)
) STRICT;
CREATE INDEX resource_visibility_date ON resources(deleted_at,updated_at DESC);
