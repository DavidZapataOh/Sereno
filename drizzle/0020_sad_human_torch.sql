CREATE TABLE `net_worth_snapshots` (
	`owner_id` text NOT NULL,
	`dia` text NOT NULL,
	`patrimonio` text NOT NULL,
	`moneda` text NOT NULL,
	`tasas` text NOT NULL,
	`tomada_en` text NOT NULL,
	PRIMARY KEY(`owner_id`, `dia`)
);
--> statement-breakpoint
CREATE INDEX `idx_snapshots_owner_dia` ON `net_worth_snapshots` (`owner_id`,`dia`);