CREATE TABLE `loginLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(50) NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`userAgent` text,
	`success` boolean DEFAULT true,
	`failureReason` text,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `loginLogs_id` PRIMARY KEY(`id`)
);
