CREATE TABLE IF NOT EXISTS cms_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL CHECK (json_valid(data))
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  csrf TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  message TEXT NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 5000),
  page TEXT CHECK (length(page) <= 200)
);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at DESC);
CREATE TRIGGER IF NOT EXISTS messages_throttle BEFORE INSERT ON messages
WHEN (SELECT count(*) FROM messages WHERE created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 minute')) >= 10
  OR (SELECT count(*) FROM messages WHERE created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')) >= 200
BEGIN SELECT RAISE(ABORT, 'message_rate_limit'); END;
