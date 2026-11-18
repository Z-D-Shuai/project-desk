CREATE TABLE participants (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, role TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 1, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE project_participants (
 project_id TEXT NOT NULL REFERENCES projects(id), participant_id TEXT NOT NULL REFERENCES participants(id),
 PRIMARY KEY(project_id,participant_id)
) STRICT;
ALTER TABLE journal_entries ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE journal_entries ADD COLUMN files TEXT NOT NULL DEFAULT '';
ALTER TABLE journal_entries ADD COLUMN result TEXT NOT NULL DEFAULT '';
ALTER TABLE journal_entries ADD COLUMN problems TEXT NOT NULL DEFAULT '';
ALTER TABLE journal_entries ADD COLUMN next_step TEXT NOT NULL DEFAULT '';
ALTER TABLE journal_entries ADD COLUMN notes TEXT NOT NULL DEFAULT '';
ALTER TABLE journal_entries ADD COLUMN important INTEGER NOT NULL DEFAULT 0 CHECK(important IN(0,1));
ALTER TABLE journal_entries ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE journal_entries ADD COLUMN deleted_at TEXT;
CREATE TABLE journal_participants (
 journal_id TEXT NOT NULL REFERENCES journal_entries(id), participant_id TEXT NOT NULL REFERENCES participants(id),
 PRIMARY KEY(journal_id,participant_id)
) STRICT;
CREATE TABLE project_workspaces (
 project_id TEXT PRIMARY KEY REFERENCES projects(id), current_work TEXT NOT NULL DEFAULT '',
 problems TEXT NOT NULL DEFAULT '', ideas TEXT NOT NULL DEFAULT '', next_step TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
) STRICT;
