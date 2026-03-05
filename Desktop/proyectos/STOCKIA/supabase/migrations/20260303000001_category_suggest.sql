-- ============================================================
-- Category Suggestion System ("IA" de categorías en tiempo real)
-- ============================================================

-- Enable pg_trgm for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ──────────────────────────────────────────────
-- A) Enrich existing categories table
-- ──────────────────────────────────────────────
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS path TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 0;

-- Allow business_id to be null for global (default) categories
ALTER TABLE categories ALTER COLUMN business_id DROP NOT NULL;

-- Index for keyword search
CREATE INDEX IF NOT EXISTS idx_categories_keywords ON categories USING GIN (keywords);
CREATE INDEX IF NOT EXISTS idx_categories_business ON categories (business_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories (parent_id);

-- ──────────────────────────────────────────────
-- B) category_aliases (sinónimos + reglas rápidas)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS category_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),  -- null = global
  alias TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  weight INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_category_aliases_business_alias
  ON category_aliases (business_id, alias);
CREATE INDEX IF NOT EXISTS idx_category_aliases_trgm
  ON category_aliases USING GIN (alias gin_trgm_ops);

-- ──────────────────────────────────────────────
-- C) product_category_feedback (aprendizaje)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_category_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  normalized_name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  chosen_count INT NOT NULL DEFAULT 1,
  last_chosen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, normalized_name, category_id)
);

CREATE INDEX IF NOT EXISTS idx_pcf_trgm
  ON product_category_feedback USING GIN (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pcf_business
  ON product_category_feedback (business_id);

-- ──────────────────────────────────────────────
-- RLS Policies
-- ──────────────────────────────────────────────

-- categories: allow reading globals (business_id IS NULL) + own
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "categories_select" ON categories;
DROP POLICY IF EXISTS "categories_insert" ON categories;
DROP POLICY IF EXISTS "categories_update" ON categories;
DROP POLICY IF EXISTS "categories_delete" ON categories;

CREATE POLICY "categories_select" ON categories FOR SELECT USING (
  business_id IS NULL
  OR business_id = (SELECT business_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (
  business_id = (SELECT business_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (
  business_id = (SELECT business_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (
  business_id = (SELECT business_id FROM users WHERE id = auth.uid())
);

-- category_aliases
ALTER TABLE category_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aliases_select" ON category_aliases;
DROP POLICY IF EXISTS "aliases_insert" ON category_aliases;
DROP POLICY IF EXISTS "aliases_update" ON category_aliases;
DROP POLICY IF EXISTS "aliases_delete" ON category_aliases;
CREATE POLICY "aliases_select" ON category_aliases FOR SELECT USING (
  business_id IS NULL
  OR business_id = (SELECT business_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "aliases_insert" ON category_aliases FOR INSERT WITH CHECK (
  business_id = (SELECT business_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "aliases_update" ON category_aliases FOR UPDATE USING (
  business_id = (SELECT business_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "aliases_delete" ON category_aliases FOR DELETE USING (
  business_id = (SELECT business_id FROM users WHERE id = auth.uid())
);

-- product_category_feedback
ALTER TABLE product_category_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feedback_select" ON product_category_feedback;
DROP POLICY IF EXISTS "feedback_insert" ON product_category_feedback;
DROP POLICY IF EXISTS "feedback_update" ON product_category_feedback;
DROP POLICY IF EXISTS "feedback_delete" ON product_category_feedback;
CREATE POLICY "feedback_select" ON product_category_feedback FOR SELECT USING (
  business_id = (SELECT business_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "feedback_insert" ON product_category_feedback FOR INSERT WITH CHECK (
  business_id = (SELECT business_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "feedback_update" ON product_category_feedback FOR UPDATE USING (
  business_id = (SELECT business_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "feedback_delete" ON product_category_feedback FOR DELETE USING (
  business_id = (SELECT business_id FROM users WHERE id = auth.uid())
);

-- ──────────────────────────────────────────────
-- SEED: Global categories with keywords
-- ──────────────────────────────────────────────

-- Helper: insert global categories and aliases
DO $$
DECLARE
  cat_piscina UUID;
  cat_piscina_quimicos UUID;
  cat_piscina_accesorios UUID;
  cat_riego UUID;
  cat_ferreteria UUID;
  cat_ferreteria_fijacion UUID;
  cat_ferreteria_herramientas UUID;
  cat_electricidad UUID;
  cat_sanitarios UUID;
  cat_pintureria UUID;
  cat_almacen UUID;
  cat_limpieza UUID;
  cat_jardin UUID;
  cat_iluminacion UUID;
  cat_adhesivos UUID;
  cat_seguridad UUID;
  cat_plomeria UUID;
BEGIN
  -- ── Piscina ──
  INSERT INTO categories (id, business_id, name, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Piscina', 'Piscina',
    ARRAY['piscina','pileta','pool','natacion'], 10)
  RETURNING id INTO cat_piscina;

  INSERT INTO categories (id, business_id, name, parent_id, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Químicos', cat_piscina, 'Piscina > Químicos',
    ARRAY['cloro','algicida','ph','clarificador','floculante','sulfato','acido','quimico','triple','pastilla','granulado','liquido','shock'], 10)
  RETURNING id INTO cat_piscina_quimicos;

  INSERT INTO categories (id, business_id, name, parent_id, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Accesorios Piscina', cat_piscina, 'Piscina > Accesorios',
    ARRAY['filtro','bomba','boya','red','barrefondo','manguera','clorador','skimmer','escalera','lona','cobertor'], 5)
  RETURNING id INTO cat_piscina_accesorios;

  -- Aliases for Piscina > Químicos
  INSERT INTO category_aliases (business_id, alias, category_id, weight) VALUES
    (NULL, 'cloro liquido', cat_piscina_quimicos, 15),
    (NULL, 'cloro granulado', cat_piscina_quimicos, 15),
    (NULL, 'triple accion', cat_piscina_quimicos, 15),
    (NULL, 'pastillas triple', cat_piscina_quimicos, 15),
    (NULL, 'algicida', cat_piscina_quimicos, 12),
    (NULL, 'clarificador', cat_piscina_quimicos, 12),
    (NULL, 'ph menos', cat_piscina_quimicos, 12),
    (NULL, 'ph mas', cat_piscina_quimicos, 12),
    (NULL, 'sulfato de aluminio', cat_piscina_quimicos, 12),
    (NULL, 'cloro multiaccion', cat_piscina_quimicos, 15),
    (NULL, 'hipoclorito', cat_piscina_quimicos, 12);

  INSERT INTO category_aliases (business_id, alias, category_id, weight) VALUES
    (NULL, 'barrefondo', cat_piscina_accesorios, 12),
    (NULL, 'bomba piscina', cat_piscina_accesorios, 12),
    (NULL, 'filtro arena', cat_piscina_accesorios, 12),
    (NULL, 'manguera piscina', cat_piscina_accesorios, 10),
    (NULL, 'lona piscina', cat_piscina_accesorios, 10);

  -- ── Riego ──
  INSERT INTO categories (id, business_id, name, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Riego', 'Riego',
    ARRAY['riego','aspersor','gotero','goteo','electrovalvula','programador','difusor','micro','aspersion','sprinkler','manguera'], 8)
  RETURNING id INTO cat_riego;

  INSERT INTO category_aliases (business_id, alias, category_id, weight) VALUES
    (NULL, 'aspersor', cat_riego, 12),
    (NULL, 'gotero', cat_riego, 12),
    (NULL, 'electrovalvula', cat_riego, 12),
    (NULL, 'programador riego', cat_riego, 15),
    (NULL, 'micro aspersor', cat_riego, 12),
    (NULL, 'difusor riego', cat_riego, 12);

  -- ── Ferretería ──
  INSERT INTO categories (id, business_id, name, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Ferretería', 'Ferretería',
    ARRAY['ferreteria','herramienta','tornillo','clavo','bisagra','cerradura','candado','llave','abrazadera','precinto','cadena','gancho','escuadra','soporte','mensula','visagra','pasador','traba','rejilla','chapa'], 8)
  RETURNING id INTO cat_ferreteria;

  INSERT INTO categories (id, business_id, name, parent_id, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Fijación', cat_ferreteria, 'Ferretería > Fijación',
    ARRAY['tornillo','tarugo','bulon','arandela','clavo','tuerca','grampa','tirafondo','autorroscante','abrazadera','precinto','remache','grapa','fijacion'], 8)
  RETURNING id INTO cat_ferreteria_fijacion;

  INSERT INTO categories (id, business_id, name, parent_id, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Herramientas', cat_ferreteria, 'Ferretería > Herramientas',
    ARRAY['destornillador','pinza','llave','martillo','sierra','taladro','amoladora','nivel','cinta','metro'], 5)
  RETURNING id INTO cat_ferreteria_herramientas;

  INSERT INTO category_aliases (business_id, alias, category_id, weight) VALUES
    (NULL, 'tornillo', cat_ferreteria_fijacion, 12),
    (NULL, 'tarugo', cat_ferreteria_fijacion, 12),
    (NULL, 'bulon', cat_ferreteria_fijacion, 12),
    (NULL, 'arandela', cat_ferreteria_fijacion, 12),
    (NULL, 'tirafondo', cat_ferreteria_fijacion, 12),
    (NULL, 'autorroscante', cat_ferreteria_fijacion, 12),
    (NULL, 'destornillador', cat_ferreteria_herramientas, 12),
    (NULL, 'pinza', cat_ferreteria_herramientas, 10),
    (NULL, 'martillo', cat_ferreteria_herramientas, 12),
    (NULL, 'llave combinada', cat_ferreteria_herramientas, 12),
    (NULL, 'cinta metrica', cat_ferreteria_herramientas, 10),
    (NULL, 'abrazadera', cat_ferreteria_fijacion, 12),
    (NULL, 'precinto', cat_ferreteria_fijacion, 12),
    (NULL, 'remache', cat_ferreteria_fijacion, 12),
    (NULL, 'gancho', cat_ferreteria, 10),
    (NULL, 'escuadra', cat_ferreteria, 10),
    (NULL, 'mensula', cat_ferreteria, 10),
    (NULL, 'bisagra', cat_ferreteria, 12),
    (NULL, 'cerradura', cat_ferreteria, 12),
    (NULL, 'candado', cat_ferreteria, 12);

  -- ── Electricidad ──
  INSERT INTO categories (id, business_id, name, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Electricidad', 'Electricidad',
    ARRAY['cable','termica','disyuntor','interruptor','toma','enchufe','ficha','zapatilla','prolongador','canaleta','tubo'], 8)
  RETURNING id INTO cat_electricidad;

  INSERT INTO category_aliases (business_id, alias, category_id, weight) VALUES
    (NULL, 'cable', cat_electricidad, 10),
    (NULL, 'termica', cat_electricidad, 12),
    (NULL, 'disyuntor', cat_electricidad, 12),
    (NULL, 'interruptor', cat_electricidad, 10),
    (NULL, 'zapatilla electrica', cat_electricidad, 12),
    (NULL, 'prolongador', cat_electricidad, 12),
    (NULL, 'canaleta', cat_electricidad, 10);

  -- ── Sanitarios / Plomería ──
  INSERT INTO categories (id, business_id, name, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Sanitarios', 'Sanitarios',
    ARRAY['sifon','griferia','flexible','canilla','valvula','tanque','inodoro','bidet','pileta','grifo','mezcladora'], 8)
  RETURNING id INTO cat_sanitarios;

  INSERT INTO category_aliases (business_id, alias, category_id, weight) VALUES
    (NULL, 'canilla', cat_sanitarios, 12),
    (NULL, 'valvula', cat_sanitarios, 10),
    (NULL, 'sifon', cat_sanitarios, 12),
    (NULL, 'flexible', cat_sanitarios, 10),
    (NULL, 'griferia', cat_sanitarios, 12),
    (NULL, 'tanque', cat_sanitarios, 8),
    (NULL, 'flotante', cat_sanitarios, 10);

  -- ── Plomería ──
  INSERT INTO categories (id, business_id, name, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Plomería', 'Plomería',
    ARRAY['caño','pvc','polipropileno','pead','codo','te','union','cupla','reduccion','niple','rosca','teflon','junta'], 8)
  RETURNING id INTO cat_plomeria;

  INSERT INTO category_aliases (business_id, alias, category_id, weight) VALUES
    (NULL, 'caño pvc', cat_plomeria, 12),
    (NULL, 'codo', cat_plomeria, 10),
    (NULL, 'cupla', cat_plomeria, 10),
    (NULL, 'teflon', cat_plomeria, 12),
    (NULL, 'niple', cat_plomeria, 10);

  -- ── Pinturería ──
  INSERT INTO categories (id, business_id, name, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Pinturería', 'Pinturería',
    ARRAY['latex','esmalte','rodillo','pincel','aguarras','enduido','masilla','sellador','barniz','impermeabilizante','membrana','brocha'], 8)
  RETURNING id INTO cat_pintureria;

  INSERT INTO category_aliases (business_id, alias, category_id, weight) VALUES
    (NULL, 'latex', cat_pintureria, 12),
    (NULL, 'esmalte sintetico', cat_pintureria, 12),
    (NULL, 'rodillo', cat_pintureria, 12),
    (NULL, 'aguarras', cat_pintureria, 12),
    (NULL, 'enduido', cat_pintureria, 12),
    (NULL, 'membrana liquida', cat_pintureria, 12);

  -- ── Limpieza ──
  INSERT INTO categories (id, business_id, name, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Limpieza', 'Limpieza',
    ARRAY['limpieza','lavandina','detergente','desinfectante','trapo','balde','escoba','secador','guante','esponja','pulverizador','dispenser'], 8)
  RETURNING id INTO cat_limpieza;

  INSERT INTO category_aliases (business_id, alias, category_id, weight) VALUES
    (NULL, 'lavandina', cat_limpieza, 12),
    (NULL, 'detergente', cat_limpieza, 12),
    (NULL, 'desinfectante', cat_limpieza, 12),
    (NULL, 'escoba', cat_limpieza, 12),
    (NULL, 'pulverizador', cat_limpieza, 10),
    (NULL, 'dispenser', cat_limpieza, 10),
    (NULL, 'balde', cat_limpieza, 10);

  -- ── Almacén ──
  INSERT INTO categories (id, business_id, name, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Almacén', 'Almacén',
    ARRAY['yerba','azucar','aceite','fideos','arroz','galletitas','bebida','harina','sal','cafe','leche','mate'], 6)
  RETURNING id INTO cat_almacen;

  INSERT INTO category_aliases (business_id, alias, category_id, weight) VALUES
    (NULL, 'yerba', cat_almacen, 12),
    (NULL, 'azucar', cat_almacen, 12),
    (NULL, 'aceite', cat_almacen, 10),
    (NULL, 'fideos', cat_almacen, 12),
    (NULL, 'arroz', cat_almacen, 12),
    (NULL, 'galletitas', cat_almacen, 12);

  -- ── Jardín ──
  INSERT INTO categories (id, business_id, name, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Jardín', 'Jardín',
    ARRAY['jardin','maceta','tierra','sustrato','fertilizante','cesped','bordeadora','poda','tijera','manguera','regadera'], 6)
  RETURNING id INTO cat_jardin;

  -- ── Iluminación ──
  INSERT INTO categories (id, business_id, name, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Iluminación', 'Iluminación',
    ARRAY['lampara','led','foco','tubo','dicroica','plafon','aplique','reflector','tira','luz'], 6)
  RETURNING id INTO cat_iluminacion;

  -- ── Adhesivos / Selladores ──
  INSERT INTO categories (id, business_id, name, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Adhesivos y Selladores', 'Adhesivos y Selladores',
    ARRAY['silicona','adhesivo','pegamento','cinta','epoxi','poxipol','la gotita','cola','vinilica','sellador'], 6)
  RETURNING id INTO cat_adhesivos;

  INSERT INTO category_aliases (business_id, alias, category_id, weight) VALUES
    (NULL, 'silicona', cat_adhesivos, 12),
    (NULL, 'poxipol', cat_adhesivos, 15),
    (NULL, 'la gotita', cat_adhesivos, 15),
    (NULL, 'cola vinilica', cat_adhesivos, 12),
    (NULL, 'cinta doble faz', cat_adhesivos, 10);

  -- ── Seguridad ──
  INSERT INTO categories (id, business_id, name, path, keywords, priority)
  VALUES (gen_random_uuid(), NULL, 'Seguridad', 'Seguridad',
    ARRAY['candado','cerradura','cerrojo','cadena','matafuego','extintor','alarma','sensor','camara','guante','casco','proteccion'], 6)
  RETURNING id INTO cat_seguridad;

END $$;
