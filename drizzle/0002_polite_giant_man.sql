CREATE TABLE `ingest_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`fuente` text NOT NULL,
	`iniciado_en` text NOT NULL,
	`terminado_en` text,
	`capturas` integer DEFAULT 0 NOT NULL,
	`extraidas` integer DEFAULT 0 NOT NULL,
	`nuevas` integer DEFAULT 0 NOT NULL,
	`duplicadas` integer DEFAULT 0 NOT NULL,
	`transferencias` integer DEFAULT 0 NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `idx_ingest_runs_owner_fuente` ON `ingest_runs` (`owner_id`,`fuente`,`iniciado_en`);--> statement-breakpoint
CREATE TABLE `transaction_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`fuente` text NOT NULL,
	`referencia` text,
	`huella` text NOT NULL,
	`capturado_en` text NOT NULL,
	`run_id` text,
	`crudo` text NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_observations_origen` ON `transaction_observations` (`owner_id`,`fuente`,`referencia`);--> statement-breakpoint
CREATE INDEX `idx_observations_huella` ON `transaction_observations` (`owner_id`,`huella`);--> statement-breakpoint
CREATE INDEX `idx_observations_transaction` ON `transaction_observations` (`transaction_id`);