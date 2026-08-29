CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`nombre` text NOT NULL,
	`currency` text NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_accounts_owner` ON `accounts` (`owner_id`);--> statement-breakpoint
CREATE TABLE `postings` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`account_id` text NOT NULL,
	`amount` text NOT NULL,
	`currency` text NOT NULL,
	`nota` text,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_postings_account` ON `postings` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_postings_transaction` ON `postings` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`fecha` text NOT NULL,
	`descripcion` text NOT NULL,
	`fuente` text NOT NULL,
	`referencia` text
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_fecha` ON `transactions` (`fecha`);--> statement-breakpoint
CREATE INDEX `idx_transactions_owner` ON `transactions` (`owner_id`);