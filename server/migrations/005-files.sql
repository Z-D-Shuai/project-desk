CREATE TABLE storage_roots (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
 path TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
) STRICT;
INSERT INTO storage_roots VALUES
 ('legacy','原资料目录','other','@data/assets',1,strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('images','图片目录','image','@data/images',1,strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('videos','视频目录','video','@data/videos',1,strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('attachments','文档及附件','file','@data/attachments',1,strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('projects','项目文件目录','project','@data/projects',1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
CREATE TABLE file_objects (
 id TEXT PRIMARY KEY, root_id TEXT REFERENCES storage_roots(id), path TEXT NOT NULL,
 storage_mode TEXT NOT NULL CHECK(storage_mode IN('managed','reference')),
 name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, sha256 TEXT,
 revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
 deleted_at TEXT, trash_path TEXT, purged_at TEXT
) STRICT;
CREATE UNIQUE INDEX file_object_location ON file_objects(storage_mode,COALESCE(root_id,''),path COLLATE NOCASE) WHERE purged_at IS NULL AND deleted_at IS NULL;
ALTER TABLE file_assets ADD COLUMN file_id TEXT REFERENCES file_objects(id);
INSERT INTO file_objects(id,root_id,path,storage_mode,name,mime,size,sha256,created_at)
 SELECT 'legacy-'||MIN(id),CASE WHEN storage_mode='managed' THEN 'legacy' ELSE NULL END,
 CASE WHEN storage_mode='managed' AND path LIKE 'assets/%' THEN substr(path,8) ELSE path END,
 storage_mode,MIN(original_name),MIN(mime),MAX(size),MIN(sha256),MIN(created_at)
 FROM file_assets GROUP BY storage_mode,path COLLATE NOCASE;
UPDATE file_assets SET file_id=(SELECT o.id FROM file_objects o WHERE o.storage_mode=file_assets.storage_mode AND
 o.path=CASE WHEN file_assets.storage_mode='managed' AND file_assets.path LIKE 'assets/%' THEN substr(file_assets.path,8) ELSE file_assets.path END COLLATE NOCASE);
CREATE TABLE storage_folders (root_id TEXT NOT NULL REFERENCES storage_roots(id),path TEXT NOT NULL,PRIMARY KEY(root_id,path)) STRICT;
CREATE TABLE file_trash (
 id TEXT PRIMARY KEY, root_id TEXT REFERENCES storage_roots(id), original_path TEXT NOT NULL,
 stored_path TEXT, payload TEXT NOT NULL, deleted_at TEXT NOT NULL
) STRICT;
CREATE TABLE disk_jobs (id TEXT PRIMARY KEY,payload TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,error TEXT) STRICT;
