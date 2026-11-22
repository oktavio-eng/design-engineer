CREATE TABLE IF NOT EXISTS contributions (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  fetched_at TEXT NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data))
);
