CREATE TABLE `classifier_evidence` (
	`owner_id` text NOT NULL,
	`feature` text NOT NULL,
	`categoria` text NOT NULL,
	`cuenta` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner_id`, `feature`, `categoria`)
);
--> statement-breakpoint
CREATE INDEX `idx_evidence_owner_feature` ON `classifier_evidence` (`owner_id`,`feature`);