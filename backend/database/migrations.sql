CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    matricule VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER'
        CHECK (role IN ('ADMIN', 'TECHNICIAN', 'CHEF_DE_SUPPORT', 'CHEF_DE_SERVICE', 'USER')),
    department VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_ip_address VARCHAR(45),
    last_seen_at TIMESTAMPTZ,
    password_reset_requested_at TIMESTAMPTZ,
    password_reset_code_hash VARCHAR(64) NOT NULL DEFAULT '',
    password_reset_expires_at TIMESTAMPTZ,
    password_reset_attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    request_language VARCHAR(2) NOT NULL DEFAULT 'fr',
    request_utc_offset_minutes INTEGER NOT NULL DEFAULT 0,
    priority VARCHAR(20) NOT NULL
        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING_APPROVAL', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED')),
    created_by_id UUID NOT NULL REFERENCES users(id),
    assigned_to_id UUID REFERENCES users(id),
    department VARCHAR(100) NOT NULL,
    estimated_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    approval_notes TEXT,
    sla_deadline TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets (priority);
CREATE INDEX IF NOT EXISTS idx_tickets_creator ON tickets (created_by_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets (assigned_to_id);

CREATE SEQUENCE IF NOT EXISTS ticket_reference_seq;

CREATE TABLE IF NOT EXISTS ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments (ticket_id);

CREATE TABLE IF NOT EXISTS ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments (ticket_id);

CREATE TABLE IF NOT EXISTS ticket_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    notes TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket ON ticket_history (ticket_id);

CREATE TABLE IF NOT EXISTS sla_policies (
    priority VARCHAR(20) PRIMARY KEY
        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    max_hours DOUBLE PRECISION NOT NULL CHECK (max_hours > 0),
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
    name VARCHAR(100) PRIMARY KEY
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip_address VARCHAR(45);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_requested_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_code_hash VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tickets ALTER COLUMN ticket_number TYPE VARCHAR(64);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS request_language VARCHAR(2) NOT NULL DEFAULT 'fr';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS request_utc_offset_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ticket_history ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

INSERT INTO departments (name) VALUES
    ('Direction des Systèmes d''Information (DSI)'),
    ('Direction Financière & Comptabilité'),
    ('Direction des Ressources Humaines'),
    ('Direction Commerciale & Marketing'),
    ('Direction des Opérations & Logistique'),
    ('Support & Infrastructure IT'),
    ('Direction Juridique & Conformité'),
    ('Direction Audit & Contrôle de Gestion')
ON CONFLICT (name) DO NOTHING;
