ALTER TABLE projects ADD COLUMN last_followed_at TEXT;
CREATE TABLE reminder_settings (
 id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 1,
 projects_enabled INTEGER NOT NULL DEFAULT 1, resources_enabled INTEGER NOT NULL DEFAULT 1,
 project_days INTEGER NOT NULL DEFAULT 30, resource_days INTEGER NOT NULL DEFAULT 60,
 repeat_days INTEGER NOT NULL DEFAULT 7, snooze_days INTEGER NOT NULL DEFAULT 7,
 daily_time TEXT NOT NULL DEFAULT '09:00', revision INTEGER NOT NULL DEFAULT 1
) STRICT;
INSERT INTO reminder_settings(id) VALUES(1);
CREATE TABLE reminder_rules (
 kind TEXT NOT NULL CHECK(kind IN('project','resource','category')),entity_id TEXT NOT NULL,
 days INTEGER, repeat_days INTEGER, paused INTEGER NOT NULL DEFAULT 0,
 snoozed_until TEXT, handled_at TEXT, revision INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(kind,entity_id)
) STRICT;
CREATE TABLE reminder_history (
 id TEXT PRIMARY KEY,kind TEXT NOT NULL,entity_id TEXT NOT NULL,title TEXT NOT NULL,
 action TEXT NOT NULL,occurred_at TEXT NOT NULL,detail TEXT NOT NULL DEFAULT ''
) STRICT;
CREATE TABLE reminder_deliveries (
 id TEXT PRIMARY KEY,created_at TEXT NOT NULL,status TEXT NOT NULL,
 items TEXT NOT NULL,error TEXT,completed_at TEXT
) STRICT;
CREATE TABLE reminder_notified (
 kind TEXT NOT NULL,entity_id TEXT NOT NULL,cycle TEXT NOT NULL,
 delivered_at TEXT NOT NULL,delivery_id TEXT NOT NULL,PRIMARY KEY(kind,entity_id)
) STRICT;
CREATE TABLE reminder_runtime (key TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT;
