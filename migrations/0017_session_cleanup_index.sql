-- Migration 0017: Índice adicional en sessions para limpieza eficiente + creación de tenant_id index
-- Permite DELETE FROM sessions WHERE expires_at < ? sin full-table scan

CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id, expires_at);
