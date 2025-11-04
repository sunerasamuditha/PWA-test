-- Migration: Create invoice_sequences table for atomic invoice number generation
-- This table stores a single row per year to track the last sequence number

CREATE TABLE IF NOT EXISTS `invoice_sequences` (
  `year` INT NOT NULL,
  `last_sequence` INT NOT NULL DEFAULT 0,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create index for faster lookups
CREATE INDEX idx_updated_at ON `invoice_sequences` (`updated_at`);

-- Initialize with current year if needed
INSERT INTO `invoice_sequences` (`year`, `last_sequence`) 
VALUES (YEAR(CURDATE()), 0)
ON DUPLICATE KEY UPDATE `year` = `year`;
