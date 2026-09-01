CREATE TABLE `debts` (
	`account_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`tipo` text NOT NULL,
	`nombre` text NOT NULL,
	`tasa_valor` text,
	`tasa_tipo` text,
	`cuotas_totales` integer,
	`dia_de_pago` integer
);
--> statement-breakpoint
CREATE INDEX `idx_debts_owner` ON `debts` (`owner_id`);