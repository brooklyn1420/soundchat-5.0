ALTER TABLE `profile` ADD COLUMN `default_disappearing_seconds` integer DEFAULT 86400;
--> statement-breakpoint
ALTER TABLE `conversations` ADD COLUMN `disappearing_seconds` integer DEFAULT 86400;
--> statement-breakpoint
ALTER TABLE `messages` ADD COLUMN `expires_at` integer;
--> statement-breakpoint
ALTER TABLE `messages` ADD COLUMN `kept` integer DEFAULT 0 NOT NULL;
