-- Migration: Remove chat_messages table and related index (chatbot removal)
-- Run this in Supabase SQL Editor to drop persistent chat storage

DROP INDEX IF EXISTS idx_chat_messages_group_id;
DROP TABLE IF EXISTS chat_messages;
