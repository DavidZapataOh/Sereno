CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`salida` text NOT NULL,
	`entrada` text NOT NULL,
	`observaciones_entrada` text NOT NULL,
	`estado` text NOT NULL,
	`detectada_en` text NOT NULL,
	`resuelta_en` text,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_transfers_owner_estado` ON `transfers` (`owner_id`,`estado`);--> statement-breakpoint
CREATE INDEX `idx_transfers_transaction` ON `transfers` (`transaction_id`);