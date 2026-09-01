CREATE TABLE `sinking_funds` (
	`account_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`nombre` text NOT NULL,
	`objetivo` text NOT NULL,
	`moneda` text NOT NULL,
	`proxima_fecha` text NOT NULL,
	`cada_meses` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sinking_owner` ON `sinking_funds` (`owner_id`);