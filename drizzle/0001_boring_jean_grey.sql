DROP INDEX `idx_transactions_fecha`;--> statement-breakpoint
DROP INDEX `idx_transactions_owner`;--> statement-breakpoint
CREATE INDEX `idx_transactions_owner_fecha` ON `transactions` (`owner_id`,`fecha`,`id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_origen` ON `transactions` (`owner_id`,`fuente`,`referencia`);