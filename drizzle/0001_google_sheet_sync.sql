ALTER TABLE `submissions` ADD `sheet_sync_status` text DEFAULT 'disabled' NOT NULL CHECK (`sheet_sync_status` in ('disabled','pending','synced','failed'));--> statement-breakpoint
ALTER TABLE `submissions` ADD `sheet_synced_at` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `sheet_sync_error` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `sheet_remote_range` text;--> statement-breakpoint
CREATE INDEX `idx_sub_sheet_sync_status` ON `submissions` (`sheet_sync_status`);
