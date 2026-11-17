CREATE TABLE `documents` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `editors` (
	`email` text PRIMARY KEY NOT NULL,
	`added_at` text NOT NULL
);
