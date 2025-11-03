-- Migration: Create push_subscriptions table for PWA push notifications
-- Phase: 12 (PWA Enhancement)
-- Description: Stores push notification subscriptions for web push notifications

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign key
  CONSTRAINT fk_push_subscription_user FOREIGN KEY (user_id) 
    REFERENCES users(id) ON DELETE CASCADE,
  
  -- Indexes
  INDEX idx_push_subscription_user_id (user_id),
  INDEX idx_push_subscription_active (is_active),
  INDEX idx_push_subscription_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comment to table
ALTER TABLE push_subscriptions COMMENT = 'Stores push notification subscriptions for PWA';
