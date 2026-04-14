-- =============================================================
-- 🚀 NEXOVENTAS - SQL Schema para Supabase
-- Sistema de Gestión Comercial SaaS Multi-tenant
-- =============================================================

-- Activar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- TABLA: businesses
-- =============================================================
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  logo_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('basic', 'pro', 'premium', 'vip', 'free')),
  subscription_status TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('active', 'expired', 'trial')),
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 21.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLA: users (profiles)
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'seller' CHECK (role IN ('admin', 'seller')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLA: categories
-- =============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

-- =============================================================
-- TABLA: products
-- =============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  stock_min INTEGER NOT NULL DEFAULT 5,
  barcode TEXT,
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLA: customers
-- =============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLA: sales
-- =============================================================
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(5,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'transfer', 'account')),
  seller_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLA: sale_items
-- =============================================================
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLA: stock_movements
-- =============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sale', 'purchase', 'adjustment')),
  quantity INTEGER NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- ÍNDICES
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id);
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(business_id, active);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_business ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_seller ON sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_business ON stock_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_categories_business ON categories(business_id);

-- =============================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================

-- Activar RLS en todas las tablas
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Función helper: obtener business_id del usuario actual
CREATE OR REPLACE FUNCTION get_user_business_id()
RETURNS UUID AS $$
  SELECT business_id FROM users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- =============================================================
-- POLÍTICAS RLS: businesses
-- =============================================================
DROP POLICY IF EXISTS "Authenticated users can view businesses" ON businesses;
CREATE POLICY "Authenticated users can view businesses"
  ON businesses FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own business" ON businesses;
CREATE POLICY "Users can update their own business"
  ON businesses FOR UPDATE
  USING (id = get_user_business_id())
  WITH CHECK (id = get_user_business_id());

DROP POLICY IF EXISTS "Authenticated users can insert a business" ON businesses;
CREATE POLICY "Authenticated users can insert a business"
  ON businesses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================
-- POLÍTICAS RLS: users
-- =============================================================
DROP POLICY IF EXISTS "Users can view users in their business" ON users;
CREATE POLICY "Users can view users in their business"
  ON users FOR SELECT
  USING (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
CREATE POLICY "Users can insert their own profile"
  ON users FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update users in their business" ON users;
CREATE POLICY "Admins can update users in their business"
  ON users FOR UPDATE
  USING (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Admins can delete users in their business" ON users;
CREATE POLICY "Admins can delete users in their business"
  ON users FOR DELETE
  USING (business_id = get_user_business_id());

-- =============================================================
-- POLÍTICAS RLS: categories
-- =============================================================
DROP POLICY IF EXISTS "Business isolation for categories" ON categories;
CREATE POLICY "Business isolation for categories"
  ON categories FOR ALL
  USING (business_id = get_user_business_id())
  WITH CHECK (business_id = get_user_business_id());

-- =============================================================
-- POLÍTICAS RLS: products
-- =============================================================
DROP POLICY IF EXISTS "Business isolation for products" ON products;
CREATE POLICY "Business isolation for products"
  ON products FOR ALL
  USING (business_id = get_user_business_id())
  WITH CHECK (business_id = get_user_business_id());

-- =============================================================
-- POLÍTICAS RLS: customers
-- =============================================================
DROP POLICY IF EXISTS "Business isolation for customers" ON customers;
CREATE POLICY "Business isolation for customers"
  ON customers FOR ALL
  USING (business_id = get_user_business_id())
  WITH CHECK (business_id = get_user_business_id());

-- =============================================================
-- POLÍTICAS RLS: sales
-- =============================================================
DROP POLICY IF EXISTS "Business isolation for sales" ON sales;
CREATE POLICY "Business isolation for sales"
  ON sales FOR ALL
  USING (business_id = get_user_business_id())
  WITH CHECK (business_id = get_user_business_id());

-- =============================================================
-- POLÍTICAS RLS: sale_items
-- =============================================================
DROP POLICY IF EXISTS "Business isolation for sale_items" ON sale_items;
CREATE POLICY "Business isolation for sale_items"
  ON sale_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
      AND sales.business_id = get_user_business_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
      AND sales.business_id = get_user_business_id()
    )
  );

-- =============================================================
-- POLÍTICAS RLS: stock_movements
-- =============================================================
DROP POLICY IF EXISTS "Business isolation for stock_movements" ON stock_movements;
CREATE POLICY "Business isolation for stock_movements"
  ON stock_movements FOR ALL
  USING (business_id = get_user_business_id())
  WITH CHECK (business_id = get_user_business_id());

-- =============================================================
-- FUNCIÓN: Validar stock antes de venta (para Edge Functions)
-- =============================================================
CREATE OR REPLACE FUNCTION validate_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  SELECT stock INTO current_stock
  FROM products
  WHERE id = p_product_id;
  
  IF current_stock IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN current_stock >= p_quantity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================
-- FUNCIÓN: Descontar stock atómicamente
-- =============================================================
CREATE OR REPLACE FUNCTION deduct_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE products
  SET stock = stock - p_quantity
  WHERE id = p_product_id
  AND stock >= p_quantity;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================
-- TABLA: cash_sessions (Caja)
-- =============================================================
CREATE TABLE IF NOT EXISTS cash_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_amount NUMERIC(12,2),
  expected_amount NUMERIC(12,2),
  difference NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_business ON cash_sessions(business_id);
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business isolation for cash_sessions" ON cash_sessions;
CREATE POLICY "Business isolation for cash_sessions"
  ON cash_sessions FOR ALL
  USING (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));

-- =============================================================
-- TABLA: cash_movements
-- =============================================================
CREATE TABLE IF NOT EXISTS cash_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sale', 'withdrawal', 'opening')),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(session_id);
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business isolation for cash_movements" ON cash_movements;
CREATE POLICY "Business isolation for cash_movements"
  ON cash_movements FOR ALL
  USING (session_id IN (
    SELECT id FROM cash_sessions WHERE business_id IN (
      SELECT business_id FROM users WHERE id = auth.uid()
    )
  ));
