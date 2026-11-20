ALTER TABLE messages ADD COLUMN media_blob_key TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN media_kind TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN media_content_type TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN media_duration_ms INTEGER;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN filter_id TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN caption TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN music_track_id INTEGER;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN music_title TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN music_artist TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN music_preview_url TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN music_artwork_url TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN music_track_view_url TEXT;
