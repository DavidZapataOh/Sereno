CREATE TABLE `dismissed_anomalies` (
	`owner_id` text NOT NULL,
	`anomaly_id` text NOT NULL,
	`descartada_en` text NOT NULL,
	PRIMARY KEY(`owner_id`, `anomaly_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_dismissed_owner` ON `dismissed_anomalies` (`owner_id`);