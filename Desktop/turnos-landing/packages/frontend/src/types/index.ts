export interface Company {
  id: string;
  name: string;
  subdomain: string;
  slug: string;
  email?: string;
  category?: string;
  subscription_plan: string;
  subscription_status: string;
  logo_url?: string;
  trial_ends_at?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  company_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'admin' | 'employee' | 'customer_service';
  is_active: boolean;
  email_verified?: boolean;
  last_login?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Service {
  id: string;
  company_id: string;
  name: string;
  price: number;
  duration_minutes: number;
  type: string;
}

export interface Employee {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  service_ids: string[];
}

export interface Appointment {
  id: string;
  company_id: string;
  client_id: string;
  employee_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  status: string;
}

export interface Client {
  id: string;
  company_id: string;
  name: string;
  phone: string;
  email: string;
}

// DTOs para API
export interface RegisterDto {
  email: string;
  password: string;
  company_name: string;
  company_subdomain: string;
  first_name?: string;
  last_name?: string;
  category?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  token: string;
  refreshToken: string;
  user: User;
  company: Company;
}
