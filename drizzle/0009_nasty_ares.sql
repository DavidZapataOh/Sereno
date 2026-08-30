CREATE TABLE `categories` (
	`account_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`grupo` text NOT NULL,
	`icono` text NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_categories_owner` ON `categories` (`owner_id`);--> statement-breakpoint
CREATE TABLE `transaction_classifications` (
	`transaction_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`categoria` text NOT NULL,
	`origen` text NOT NULL,
	`regla_id` text,
	`confianza` integer NOT NULL,
	`clasificado_en` text NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_classifications_owner_origen` ON `transaction_classifications` (`owner_id`,`origen`);