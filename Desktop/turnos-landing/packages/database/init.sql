-- ===================================================
-- INIT SCRIPT: Crear schema multi-tenant Turnos SaaS
-- ===================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===================================================
-- 1. COMPANIES (Tenants)
-- ===================================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255) UNIQUE,
  category VARCHAR(50), -- peluqueria, estetica, gym, consultorio, etc
  
  -- Subscription
  subscription_plan VARCHAR(50) DEFAULT 'free', -- free, basic, pro
  subscription_status VARCHAR(50) DEFAULT 'trial', -- trial, active, expired, cancelled
  trial_ends_at TIMESTAMP,
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_companies_subdomain ON companies(subdomain);
CREATE INDEX idx_companies_slug ON companies(slug);

-- ===================================================
-- 2. USERS (Admin + Employees)
-- ===================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  
  -- Role based access
  role VARCHAR(50) DEFAULT 'employee', -- admin, employee, customer_service
  permissions JSONB DEFAULT '[]'::jsonb,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  
  -- Email verification
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(company_id, email)
);

CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_email ON users(email);

-- ===================================================
-- 3. SERVICES (Servicios que ofrece el negocio)
-- ===================================================
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  duration_minutes INT NOT NULL, -- 30, 60, 90, etc
  type VARCHAR(50) DEFAULT 'presencial', -- presencial, online, domicilio
  
  -- Deposit/Seña
  deposit_type VARCHAR(50), -- percentage, fixed
  deposit_amount DECIMAL(10, 2), -- 20 (20%) o 100 (fijo)
  
  category VARCHAR(100),
  image_url TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_services_company ON services(company_id);

-- ===================================================
-- 4. EMPLOYEES (Personal del negocio)
-- ===================================================
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  
  -- Servicios que realiza (JSON array de UUIDs)
  service_ids UUID[] DEFAULT ARRAY[]::uuid[],
  
  -- Horario (JSON: {monday: {start: "09:00", end: "18:00"}, ...})
  schedule JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_employees_company ON employees(company_id);

-- ===================================================
-- 5. CLIENTS (Clientes del negocio)
-- ===================================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  
  -- Statistics
  total_spent DECIMAL(10, 2) DEFAULT 0,
  appointments_count INT DEFAULT 0,
  last_appointment_at TIMESTAMP,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_clients_company ON clients(company_id);
CREATE INDEX idx_clients_phone ON clients(company_id, phone);

-- ===================================================
-- 6. APPOINTMENTS (Turnos)
-- ===================================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  service_id UUID NOT NULL REFERENCES services(id),
  
  -- Timing
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, completed, cancelled, no_show
  notes TEXT,
  
  -- Deposit
  deposit_paid BOOLEAN DEFAULT FALSE,
  deposit_amount DECIMAL(10, 2),
  
  -- Reminders
  reminder_sent BOOLEAN DEFAULT FALSE,
  reminder_sent_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_appointments_company_date ON appointments(company_id, start_time);
CREATE INDEX idx_appointments_client ON appointments(company_id, client_id);
CREATE INDEX idx_appointments_employee ON appointments(company_id, employee_id);
CREATE INDEX idx_appointments_status ON appointments(company_id, status);

-- ===================================================
-- 7. SUBSCRIPTIONS
-- ===================================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  
  plan VARCHAR(50) NOT NULL, -- free, basic, pro
  status VARCHAR(50) DEFAULT 'active', -- active, trial, expired, cancelled
  
  -- Payment info
  payment_provider VARCHAR(50), -- mercadopago, stripe
  payment_id VARCHAR(255),
  
  -- Period
  current_period_start TIMESTAMP DEFAULT NOW(),
  current_period_end TIMESTAMP,
  
  -- Auto renew
  auto_renew BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ===================================================
-- 8. PAYMENTS (Historial de pagos)
-- ===================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  subscription_id UUID REFERENCES subscriptions(id),
  
  -- Payment info
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'ARS',
  payment_provider VARCHAR(50),
  payment_provider_id VARCHAR(255),
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed, refunded
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_company ON payments(company_id);
CREATE INDEX idx_payments_subscription ON payments(subscription_id);

-- ===================================================
-- 9. AUDIT LOG (opcional: para debugging)
-- ===================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  
  action VARCHAR(100),
  entity_type VARCHAR(100), -- appointments, clients, etc
  entity_id UUID,
  
  old_values JSONB,
  new_values JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_company ON audit_logs(company_id);

-- ===================================================
-- TRIGGERS: Actualizar updated_at automáticamente
-- ===================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at 
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at 
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at 
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at 
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================
-- SEED DATA (Opcional: para testing)
-- ===================================================
-- Descomentar si se quiere data de prueba

/*
INSERT INTO companies (name, subdomain, slug, category, subscription_plan, subscription_status)
VALUES (
  'Peluquería Test',
  'peluqueria-test',
  'peluqueria-test',
  'peluqueria',
  'basic',
  'active'
);
*/
