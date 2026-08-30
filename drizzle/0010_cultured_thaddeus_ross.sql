CREATE TABLE `rules` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`campo` text NOT NULL,
	`operador` text NOT NULL,
	`valor` text NOT NULL,
	`categoria` text NOT NULL,
	`creada_en` text NOT NULL,
	`activa` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`categoria`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rules_owner` ON `rules` (`owner_id`);