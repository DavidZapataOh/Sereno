CREATE TABLE `budget_envelopes` (
	`owner_id` text NOT NULL,
	`mes` text NOT NULL,
	`categoria` text NOT NULL,
	`asignado` text NOT NULL,
	`moneda` text NOT NULL,
	PRIMARY KEY(`owner_id`, `mes`, `categoria`)
);
--> statement-breakpoint
CREATE INDEX `idx_budget_owner_mes` ON `budget_envelopes` (`owner_id`,`mes`);