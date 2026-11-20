DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE profile (
  id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL,
  handle TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  handle TEXT,
  note TEXT,
  color TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL REFERENCES contacts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  sender TEXT NOT NULL,
  type TEXT NOT NULL,
  text TEXT,
  track_id INTEGER,
  track_title TEXT,
  artist_name TEXT,
  album_name TEXT,
  artwork_url TEXT,
  preview_url TEXT,
  track_view_url TEXT,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE saved_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT NOT NULL,
  artwork_url TEXT NOT NULL,
  preview_url TEXT NOT NULL,
  track_view_url TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  saved INTEGER NOT NULL DEFAULT 1,
  play_count INTEGER NOT NULL DEFAULT 0,
  last_played_at INTEGER,
  created_at INTEGER NOT NULL
);
