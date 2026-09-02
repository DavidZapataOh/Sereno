CREATE TABLE `balance_checkpoints` (
	`account_id` text NOT NULL,
	`mes` text NOT NULL,
	`amount` text NOT NULL,
	`currency` text NOT NULL,
	`calculado_en` text NOT NULL,
	PRIMARY KEY(`account_id`, `mes`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_checkpoints_cuenta_mes` ON `balance_checkpoints` (`account_id`,`mes`);