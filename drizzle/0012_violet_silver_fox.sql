CREATE TABLE `classification_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`comercio` text NOT NULL,
	`cambios` text NOT NULL,
	`regla_id` text,
	`creado_en` text NOT NULL,
	`deshecho_en` text
);
--> statement-breakpoint
CREATE INDEX `idx_batches_owner_creado` ON `classification_batches` (`owner_id`,`creado_en`);