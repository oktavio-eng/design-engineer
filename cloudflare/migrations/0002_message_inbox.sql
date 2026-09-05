ALTER TABLE messages ADD COLUMN read_at TEXT;
ALTER TABLE messages ADD COLUMN archived_at TEXT;
CREATE INDEX messages_inbox_idx ON messages(archived_at, created_at DESC, id DESC);
