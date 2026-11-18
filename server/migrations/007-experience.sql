CREATE TABLE usage_sessions(id TEXT PRIMARY KEY,started_ms INTEGER NOT NULL,last_seen_ms INTEGER NOT NULL,ended_ms INTEGER) STRICT;
CREATE TABLE usage_visits(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES usage_sessions(id),project_id TEXT NOT NULL REFERENCES projects(id),opened_ms INTEGER NOT NULL) STRICT;
CREATE INDEX usage_visit_project ON usage_visits(project_id,opened_ms);
CREATE TABLE usage_blocks(id TEXT PRIMARY KEY,scope TEXT NOT NULL,start_ms INTEGER NOT NULL,end_ms INTEGER NOT NULL CHECK(end_ms>start_ms)) STRICT;
CREATE INDEX usage_block_scope ON usage_blocks(scope,start_ms,end_ms);
CREATE TABLE usage_receipts(id TEXT PRIMARY KEY,received_ms INTEGER NOT NULL) STRICT;
CREATE INDEX usage_receipt_date ON usage_receipts(received_ms);

CREATE TABLE preset_defaults(key TEXT PRIMARY KEY,kind TEXT NOT NULL,name TEXT NOT NULL,icon TEXT NOT NULL,subtype TEXT NOT NULL DEFAULT '',sort_order INTEGER NOT NULL) STRICT;
INSERT INTO preset_defaults VALUES
 ('web','category','网页工具','globe','',0),('game','category','游戏开发','code','',1),('desktop','category','桌面软件','folder','',2),('image','category','图片创作','design','',3),('video','category','视频制作','camera','',4),('study','category','学习研究','book','',5),
 ('chatgpt','participant','ChatGPT','idea','AI',0),('codex','participant','Codex','code','Agent',1),('claude','participant','Claude','idea','AI',2),('gemini','participant','Gemini','idea','AI',3),('deepseek','participant','DeepSeek','idea','AI',4),('cursor','participant','Cursor','code','Agent',5),
 ('bilibili','platform','Bilibili','camera','',0),('youtube','platform','YouTube','camera','',1),('douyin','platform','抖音','camera','',2),('tiktok','platform','TikTok','camera','',3),('vimeo','platform','Vimeo','camera','',4);
CREATE TABLE presets(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN('category','participant','platform')),name TEXT NOT NULL,icon TEXT NOT NULL DEFAULT 'folder',subtype TEXT NOT NULL DEFAULT '',sort_order INTEGER NOT NULL,default_key TEXT,image_file_id TEXT REFERENCES file_objects(id),revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL) STRICT;
CREATE UNIQUE INDEX preset_name ON presets(kind,name COLLATE NOCASE);
INSERT INTO presets(id,kind,name,icon,subtype,sort_order,default_key,created_at,updated_at) SELECT 'default-'||key,kind,name,icon,subtype,sort_order,key,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM preset_defaults;
INSERT INTO storage_roots(id,name,role,path,created_at) VALUES('preset-images','预设图片','other','@data/preset-images',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
ALTER TABLE project_categories ADD COLUMN icon_file_id TEXT REFERENCES file_objects(id);
ALTER TABLE participants ADD COLUMN icon TEXT NOT NULL DEFAULT 'idea';
ALTER TABLE participants ADD COLUMN icon_file_id TEXT REFERENCES file_objects(id);
ALTER TABLE resources ADD COLUMN platform_icon TEXT NOT NULL DEFAULT '';
ALTER TABLE resources ADD COLUMN platform_image_id TEXT REFERENCES file_objects(id);
