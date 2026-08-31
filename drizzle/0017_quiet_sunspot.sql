CREATE TABLE `rates` (
	`desde` text NOT NULL,
	`hacia` text NOT NULL,
	`momento` text NOT NULL,
	`valor` text NOT NULL,
	`escala` integer NOT NULL,
	`origen` text NOT NULL,
	PRIMARY KEY(`desde`, `hacia`, `momento`)
);
--> statement-breakpoint
CREATE INDEX `idx_rates_par_momento` ON `rates` (`desde`,`hacia`,`momento`);