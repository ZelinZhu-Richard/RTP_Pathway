CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text DEFAULT 'admin' NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`detail` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`interest_tags` text,
	`format` text NOT NULL,
	`city` text NOT NULL,
	`location_detail` text,
	`grade_min` integer,
	`grade_max` integer,
	`age_min` integer,
	`age_max` integer,
	`cost_type` text DEFAULT 'free' NOT NULL,
	`cost_amount` text,
	`compensation` text DEFAULT 'none' NOT NULL,
	`compensation_detail` text,
	`schedule` text,
	`time_commitment` text,
	`what_youll_do` text,
	`eligibility_notes` text,
	`how_to_apply` text,
	`application_url` text,
	`application_deadline` text,
	`start_date` text,
	`end_date` text,
	`transportation_notes` text,
	`source_url` text,
	`contact_email` text,
	`last_verified_at` text,
	`status` text DEFAULT 'approved' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_opp_category" CHECK("opportunities"."category" in ('internship','part_time_job','volunteer','summer_program','after_school_program','competition','scholarship','workshop_course','research_program','mentorship')),
	CONSTRAINT "chk_opp_format" CHECK("opportunities"."format" in ('in_person','online','hybrid')),
	CONSTRAINT "chk_opp_cost_type" CHECK("opportunities"."cost_type" in ('free','paid_program')),
	CONSTRAINT "chk_opp_compensation" CHECK("opportunities"."compensation" in ('none','stipend','paid')),
	CONSTRAINT "chk_opp_schedule" CHECK("opportunities"."schedule" is null or "opportunities"."schedule" in ('after_school','weekend','summer','school_break','flexible')),
	CONSTRAINT "chk_opp_status" CHECK("opportunities"."status" in ('approved','archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunities_slug_unique` ON `opportunities` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_opp_category` ON `opportunities` (`category`);--> statement-breakpoint
CREATE INDEX `idx_opp_city` ON `opportunities` (`city`);--> statement-breakpoint
CREATE INDEX `idx_opp_deadline` ON `opportunities` (`application_deadline`);--> statement-breakpoint
CREATE INDEX `idx_opp_status` ON `opportunities` (`status`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_normalized` text NOT NULL,
	`website` text,
	`contact_email` text,
	`description` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_name_normalized_unique` ON `organizations` (`name_normalized`);--> statement-breakpoint
CREATE INDEX `idx_org_name_normalized` ON `organizations` (`name_normalized`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_report_reason" CHECK("reports"."reason" in ('outdated','incorrect','broken_link','other')),
	CONSTRAINT "chk_report_status" CHECK("reports"."status" in ('open','resolved','dismissed'))
);
--> statement-breakpoint
CREATE INDEX `idx_report_status` ON `reports` (`status`);--> statement-breakpoint
CREATE TABLE `search_events` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`query_text` text,
	`filters` text,
	`result_count` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "chk_search_mode" CHECK("search_events"."mode" in ('keyword','nl'))
);
--> statement-breakpoint
CREATE INDEX `idx_search_created` ON `search_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text DEFAULT 'web_form' NOT NULL,
	`submitter_name` text,
	`submitter_email` text,
	`org_name` text,
	`raw_fields` text,
	`messy_text` text,
	`extracted_fields` text,
	`missing_fields` text,
	`duplicate_warnings` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text,
	`opportunity_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`reviewed_at` text,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_sub_source" CHECK("submissions"."source" in ('web_form','csv_import')),
	CONSTRAINT "chk_sub_status" CHECK("submissions"."status" in ('pending','approved','rejected'))
);
--> statement-breakpoint
CREATE INDEX `idx_sub_status` ON `submissions` (`status`);