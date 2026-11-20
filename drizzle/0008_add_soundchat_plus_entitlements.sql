ALTER TABLE `profile` ADD COLUMN `plus_active` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `profile` ADD COLUMN `plus_started_at` integer;
--> statement-breakpoint
ALTER TABLE `profile` ADD COLUMN `owned_packs` text DEFAULT '' NOT NULL;
