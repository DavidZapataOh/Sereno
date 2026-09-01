PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sinking_funds` (
	`account_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`nombre` text NOT NULL,
	`objetivo` text NOT NULL,
	`moneda` text NOT NULL,
	`proxima_fecha` text NOT NULL,
	`cada_meses` integer,
	`tipo` text DEFAULT 'gasto' NOT NULL
);
--> statement-breakpoint
-- `tipo` no existe todavía en la tabla vieja: drizzle-kit lo puso en el SELECT
-- igualmente. Lo que había antes eran todos gastos, así que se copia literal.
INSERT INTO `__new_sinking_funds`("account_id", "owner_id", "nombre", "objetivo", "moneda", "proxima_fecha", "cada_meses", "tipo") SELECT "account_id", "owner_id", "nombre", "objetivo", "moneda", "proxima_fecha", "cada_meses", 'gasto' FROM `sinking_funds`;--> statement-breakpoint
DROP TABLE `sinking_funds`;--> statement-breakpoint
ALTER TABLE `__new_sinking_funds` RENAME TO `sinking_funds`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_sinking_owner` ON `sinking_funds` (`owner_id`);