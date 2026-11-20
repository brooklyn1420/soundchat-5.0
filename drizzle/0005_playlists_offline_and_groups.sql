ALTER TABLE saved_tracks ADD COLUMN preview_blob_key TEXT;
--> statement-breakpoint
CREATE TABLE playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE playlist_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL REFERENCES playlists(id),
  track_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT NOT NULL,
  artwork_url TEXT NOT NULL,
  preview_url TEXT NOT NULL,
  track_view_url TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
ALTER TABLE conversations ADD COLUMN kind TEXT NOT NULL DEFAULT 'direct';
--> statement-breakpoint
ALTER TABLE conversations ADD COLUMN title TEXT;
--> statement-breakpoint
CREATE TABLE conversation_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  contact_id INTEGER NOT NULL REFERENCES contacts(id)
);
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN sender_contact_id INTEGER;
