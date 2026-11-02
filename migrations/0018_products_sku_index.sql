-- Migration 0018: Índices para búsqueda directa por SKU (código de barra o referencia única)
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(tenant_id, sku);

