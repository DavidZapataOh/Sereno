CREATE TABLE `wallets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`chain` text NOT NULL,
	`direccion` text NOT NULL,
	`nombre` text NOT NULL,
	`leido_en` text,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `idx_wallets_owner` ON `wallets` (`owner_id`);