-- ScoutManager Database Schema
-- This SQL file contains all tables and initial setup for the Scout Equipment Management App

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- GROUPS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================
-- USERS TABLE  
-- =====================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Group Manager', 'Member', 'Viewer')),
    status TEXT NOT NULL CHECK (status IN ('Active', 'Pending', 'Rejected')) DEFAULT 'Pending',
    must_change_password BOOLEAN DEFAULT FALSE,
    profile_picture TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================
-- USER_GROUPS JUNCTION TABLE
-- =====================
CREATE TABLE IF NOT EXISTS user_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, group_id)
);

-- =====================
-- EQUIPMENT TABLE
-- =====================
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    location TEXT NOT NULL,
    condition TEXT NOT NULL CHECK (condition IN ('Good', 'Needs Repair', 'Broken', 'Missing')) DEFAULT 'Good',
    notes TEXT,
    date_last_checked TIMESTAMP WITH TIME ZONE,
    next_check_date TIMESTAMP WITH TIME ZONE,
    checked_by UUID REFERENCES users(id),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================
-- CAMPING_LOCATIONS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS camping_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    capacity INTEGER,
    facilities TEXT,
    notes TEXT,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================
-- CAMP_PLANS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS camp_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    location_id UUID NOT NULL REFERENCES camping_locations(id) ON DELETE CASCADE,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================
-- CAMP_PLAN_EQUIPMENT JUNCTION TABLE
-- =====================
CREATE TABLE IF NOT EXISTS camp_plan_equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camp_plan_id UUID NOT NULL REFERENCES camp_plans(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    quantity_needed INTEGER NOT NULL,
    UNIQUE(camp_plan_id, equipment_id)
);

-- =====================
-- DOCUMENTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER,
    content TEXT,
    file_url TEXT,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================
-- FOLDERS TABLE (for file management)
-- =====================
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================
-- FILES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER,
    folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================
-- CHAT_MESSAGES TABLE (for persistent chat storage)
-- =====================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================
-- APP_SETTINGS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================
-- INDEXES for performance
-- =====================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON user_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_equipment_group_id ON equipment(group_id);
CREATE INDEX IF NOT EXISTS idx_locations_group_id ON camping_locations(group_id);
CREATE INDEX IF NOT EXISTS idx_camp_plans_group_id ON camp_plans(group_id);
CREATE INDEX IF NOT EXISTS idx_documents_group_id ON documents(group_id);
CREATE INDEX IF NOT EXISTS idx_folders_group_id ON folders(group_id);
CREATE INDEX IF NOT EXISTS idx_files_group_id ON files(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_group_id ON chat_messages(group_id);

-- =====================
-- INITIAL DATA (seed data)
-- =====================
INSERT INTO groups (id, name, description) VALUES
    ('550e8400-e29b-41d4-a716-446655440001'::uuid, 'Joey Scouts', 'Youth section for ages 5-8'),
    ('550e8400-e29b-41d4-a716-446655440002'::uuid, 'Cub Scouts', 'Youth section for ages 8-11'),
    ('550e8400-e29b-41d4-a716-446655440003'::uuid, 'Venturers', 'Youth section for ages 15-17')
ON CONFLICT DO NOTHING;

-- Insert admin user (password should be hashed in production)
-- Note: Password hash should be generated with bcrypt or similar
INSERT INTO users (id, email, password_hash, name, phone, role, status) VALUES
    ('550e8400-e29b-41d4-a716-446655440011'::uuid, 'admin@scouts.org', '$2b$10$', 'Sarah Mitchell', '0400111222', 'Admin', 'Active')
ON CONFLICT DO NOTHING;

-- Associate admin with all groups
INSERT INTO user_groups (user_id, group_id) SELECT
    '550e8400-e29b-41d4-a716-446655440011'::uuid,
    id
FROM groups
ON CONFLICT DO NOTHING;

-- Insert default app settings
INSERT INTO app_settings (key, value) VALUES
    ('registrationEnabled', 'true'),
    ('accessCode', 'SCOUT2024')
ON CONFLICT DO NOTHING;
