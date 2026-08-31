-- La tabla de tarjetas (sprint 07, plan 01).
--
-- `drizzle-kit` generó además un ALTER que volvía a añadir
-- `transaction_observations.canal`, que ya existe desde la 0015: el snapshot
-- de esa migración se escribió a mano y no llevaba la columna, así que la
-- herramienta creyó que faltaba. Se quitó a mano; el snapshot de esta sí es
-- correcto y la cadena queda sana desde aquí.
CREATE TABLE `credit_cards` (
	`account_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`cupo` text NOT NULL,
	`currency` text NOT NULL,
	`dia_de_corte` integer NOT NULL,
	`dia_de_pago` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_credit_cards_owner` ON `credit_cards` (`owner_id`);
