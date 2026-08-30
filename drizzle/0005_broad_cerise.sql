CREATE TABLE `reconciliations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`account_id` text NOT NULL,
	`fecha` text NOT NULL,
	`saldo_real` text NOT NULL,
	`saldo_calculado` text NOT NULL,
	`diferencia` text NOT NULL,
	`currency` text NOT NULL,
	`veredicto` text NOT NULL,
	`fuente` text NOT NULL,
	`detalle` text NOT NULL,
	`creado_en` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reconciliations_account_fecha` ON `reconciliations` (`account_id`,`fecha`);