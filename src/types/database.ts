/* ================================================================
   STOCKIA HUB – Supabase Database Types
   Aligned with schema.sql + migration_v3.sql
   ================================================================ */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

/* ---------- Unit type for products ---------- */
export type ProductUnit = 'u' | 'kg' | 'mts' | 'lts'

export const UNIT_LABELS: Record<ProductUnit, string> = {
  u: 'Unidad',
  kg: 'Kilogramo',
  mts: 'Metro',
  lts: 'Litro',
}

export const UNIT_SHORT: Record<ProductUnit, string> = {
  u: 'uds',
  kg: 'kg',
  mts: 'mts',
  lts: 'lts',
}

/* ----------------------------------------------------------------
   Database interface (required by @supabase/supabase-js v2)
   Each table needs Row, Insert, Update, Relationships
   Schema needs Tables, Views, Functions
   ---------------------------------------------------------------- */
export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          address: string | null
          city: string | null
          logo_url: string | null
          plan: string
          subscription_status: string
          tax_rate: number
          trial_ends_at: string | null
          cuit: string | null
          iva_condition: string | null
          punto_venta: number | null
          iibb: string | null
          razon_social: string | null
          domicilio_comercial: string | null
          inicio_actividades: string | null
          receipt_footer: string | null
          auto_print: boolean
          primary_color: string | null
          ticket_size: string
          allow_negative_stock: boolean
          offline_enabled: boolean
          cert_status: string
          payment_method_discounts: Record<string, number> | null
          referral_code: string | null
          pending_discount_pct: number
          pending_discount_note: string | null
          basic_mode: boolean
          daily_summary_whatsapp: string | null
          daily_summary_email: string | null
          /** Suscripción automática de Mercado Pago (preapproval); las escribe solo el servidor. */
          mp_preapproval_id?: string | null
          mp_subscription_status?: string | null
          mp_payer_email?: string | null
          mp_next_payment_at?: string | null
          mp_plan?: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email?: string
          phone?: string | null
          address?: string | null
          city?: string | null
          logo_url?: string | null
          plan?: string
          subscription_status?: string
          tax_rate?: number
          trial_ends_at?: string | null
          cuit?: string | null
          iva_condition?: string | null
          punto_venta?: number | null
          iibb?: string | null
          razon_social?: string | null
          domicilio_comercial?: string | null
          inicio_actividades?: string | null
          receipt_footer?: string | null
          auto_print?: boolean
          primary_color?: string | null
          ticket_size?: string
          allow_negative_stock?: boolean
          offline_enabled?: boolean
          cert_status?: string
          payment_method_discounts?: Record<string, number> | null
          referral_code?: string | null
          pending_discount_pct?: number
          pending_discount_note?: string | null
          basic_mode?: boolean
          daily_summary_whatsapp?: string | null
          daily_summary_email?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string | null
          address?: string | null
          city?: string | null
          logo_url?: string | null
          plan?: string
          subscription_status?: string
          tax_rate?: number
          trial_ends_at?: string | null
          cuit?: string | null
          iva_condition?: string | null
          punto_venta?: number | null
          iibb?: string | null
          razon_social?: string | null
          domicilio_comercial?: string | null
          inicio_actividades?: string | null
          receipt_footer?: string | null
          auto_print?: boolean
          primary_color?: string | null
          ticket_size?: string
          allow_negative_stock?: boolean
          offline_enabled?: boolean
          cert_status?: string
          payment_method_discounts?: Record<string, number> | null
          referral_code?: string | null
          pending_discount_pct?: number
          pending_discount_note?: string | null
          basic_mode?: boolean
          daily_summary_whatsapp?: string | null
          daily_summary_email?: string | null
          created_at?: string
        }
        Relationships: [{
          foreignKeyName: 'users_business_id_fkey'
          columns: ['business_id']
          isOneToOne: false
          referencedRelation: 'businesses'
          referencedColumns: ['id']
        }]
      }
      users: {
        Row: {
          id: string
          business_id: string
          name: string
          email: string
          role: string
          is_superadmin: boolean
          created_at: string
        }
        Insert: {
          id: string
          business_id: string
          name: string
          email?: string
          role?: string
          is_superadmin?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          email?: string
          role?: string
          is_superadmin?: boolean
          created_at?: string
        }
        Relationships: [{
          foreignKeyName: 'categories_business_id_fkey'
          columns: ['business_id']
          isOneToOne: false
          referencedRelation: 'businesses'
          referencedColumns: ['id']
        }]
      }
      categories: {
        Row: {
          id: string
          business_id: string
          name: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
        }
        Relationships: [{
          foreignKeyName: 'suppliers_business_id_fkey'
          columns: ['business_id']
          isOneToOne: false
          referencedRelation: 'businesses'
          referencedColumns: ['id']
        }]
      }
      suppliers: {
        Row: {
          id: string
          business_id: string
          name: string
          phone: string | null
          email: string | null
          address: string | null
          cuit: string | null
          notes: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          phone?: string | null
          email?: string | null
          address?: string | null
          cuit?: string | null
          notes?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          phone?: string | null
          email?: string | null
          address?: string | null
          cuit?: string | null
          notes?: string | null
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'businesses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
        ]
      }
      products: {
        Row: {
          id: string
          business_id: string
          name: string
          description: string | null
          category_id: string | null
          purchase_price: number
          sale_price: number
          stock: number
          stock_min: number
          barcode: string | null
          code?: string | null
          image_url: string | null
          active: boolean
          unit: string
          brand: string | null
          size_label: string | null
          model: string | null
          presentation: string | null
          supplier_id: string | null
          avg_cost: number
          material?: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          description?: string | null
          category_id?: string | null
          purchase_price?: number
          sale_price?: number
          stock?: number
          stock_min?: number
          barcode?: string | null
          code?: string | null
          image_url?: string | null
          active?: boolean
          unit?: string
          brand?: string | null
          size_label?: string | null
          model?: string | null
          presentation?: string | null
          supplier_id?: string | null
          avg_cost?: number
          material?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          description?: string | null
          category_id?: string | null
          purchase_price?: number
          sale_price?: number
          stock?: number
          stock_min?: number
          barcode?: string | null
          code?: string | null
          image_url?: string | null
          active?: boolean
          unit?: string
          brand?: string | null
          size_label?: string | null
          model?: string | null
          presentation?: string | null
          supplier_id?: string | null
          avg_cost?: number
          material?: string | null
          created_at?: string
        }
        Relationships: [{
          foreignKeyName: 'customers_business_id_fkey'
          columns: ['business_id']
          isOneToOne: false
          referencedRelation: 'businesses'
          referencedColumns: ['id']
        }]
      }
      customers: {
        Row: {
          id: string
          business_id: string
          name: string
          phone: string | null
          email: string | null
          address: string | null
          doc_tipo: string
          doc_nro: string | null
          iva_condition: string
          balance: number
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          phone?: string | null
          email?: string | null
          address?: string | null
          doc_tipo?: string
          doc_nro?: string | null
          iva_condition?: string
          balance?: number
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          phone?: string | null
          email?: string | null
          address?: string | null
          doc_tipo?: string
          doc_nro?: string | null
          iva_condition?: string
          balance?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sales_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'businesses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sales_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
        ]
      }
      sales: {
        Row: {
          id: string
          business_id: string
          customer_id: string | null
          total: number
          discount: number
          payment_method: string
          seller_id: string
          receipt_type: string
          installments: number
          surcharge_pct: number
          voided: boolean
          voided_at: string | null
          voided_by: string | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          customer_id?: string | null
          total?: number
          discount?: number
          payment_method?: string
          seller_id: string
          receipt_type?: string
          installments?: number
          surcharge_pct?: number
          voided?: boolean
          voided_at?: string | null
          voided_by?: string | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          customer_id?: string | null
          total?: number
          discount?: number
          payment_method?: string
          seller_id?: string
          receipt_type?: string
          installments?: number
          surcharge_pct?: number
          voided?: boolean
          voided_at?: string | null
          voided_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sale_items_sale_id_fkey'
            columns: ['sale_id']
            isOneToOne: false
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string
          quantity: number
          price: number
          cost_at_sale: number
        }
        Insert: {
          id?: string
          sale_id: string
          product_id: string
          quantity?: number
          price?: number
          cost_at_sale?: number
        }
        Update: {
          id?: string
          sale_id?: string
          product_id?: string
          quantity?: number
          price?: number
          cost_at_sale?: number
        }
        Relationships: [{
          foreignKeyName: 'sale_payments_sale_id_fkey'
          columns: ['sale_id']
          isOneToOne: false
          referencedRelation: 'sales'
          referencedColumns: ['id']
        }]
      }
      sale_payments: {
        Row: {
          id: string
          sale_id: string
          payment_method: string
          amount: number
        }
        Insert: {
          id?: string
          sale_id: string
          payment_method: string
          amount: number
        }
        Update: {
          id?: string
          sale_id?: string
          payment_method?: string
          amount?: number
        }
        Relationships: [{
          foreignKeyName: 'stock_movements_product_id_fkey'
          columns: ['product_id']
          isOneToOne: false
          referencedRelation: 'products'
          referencedColumns: ['id']
        }]
      }
      stock_movements: {
        Row: {
          id: string
          business_id: string
          product_id: string
          type: string
          quantity: number
          reference_id: string | null
          notes: string | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          product_id: string
          type: string
          quantity: number
          reference_id?: string | null
          notes?: string | null
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          product_id?: string
          type?: string
          quantity?: number
          reference_id?: string | null
          notes?: string | null
          user_id?: string | null
          created_at?: string
        }
        Relationships: [{
          foreignKeyName: 'purchases_supplier_id_fkey'
          columns: ['supplier_id']
          isOneToOne: false
          referencedRelation: 'suppliers'
          referencedColumns: ['id']
        }]
      }
      purchases: {
        Row: {
          id: string
          business_id: string
          supplier_id: string | null
          total: number
          notes: string | null
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          supplier_id?: string | null
          total?: number
          notes?: string | null
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          supplier_id?: string | null
          total?: number
          notes?: string | null
          user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'purchase_items_purchase_id_fkey'
            columns: ['purchase_id']
            isOneToOne: false
            referencedRelation: 'purchases'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      purchase_items: {
        Row: {
          id: string
          purchase_id: string
          product_id: string
          quantity: number
          unit_cost: number
          subtotal: number
        }
        Insert: {
          id?: string
          purchase_id: string
          product_id: string
          quantity: number
          unit_cost: number
          subtotal?: number
        }
        Update: {
          id?: string
          purchase_id?: string
          product_id?: string
          quantity?: number
          unit_cost?: number
          subtotal?: number
        }
        Relationships: [{
          foreignKeyName: 'cash_sessions_business_id_fkey'
          columns: ['business_id']
          isOneToOne: false
          referencedRelation: 'businesses'
          referencedColumns: ['id']
        }]
      }
      cash_sessions: {
        Row: {
          id: string
          business_id: string
          opened_by: string
          opened_at: string
          closed_at: string | null
          closed_by: string | null
          opening_amount: number
          closing_amount: number | null
          expected_amount: number | null
          difference: number | null
          status: string
          notes: string | null
        }
        Insert: {
          id?: string
          business_id: string
          opened_by: string
          opened_at?: string
          closed_at?: string | null
          closed_by?: string | null
          opening_amount?: number
          closing_amount?: number | null
          expected_amount?: number | null
          difference?: number | null
          status?: string
          notes?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          opened_by?: string
          opened_at?: string
          closed_at?: string | null
          closed_by?: string | null
          opening_amount?: number
          closing_amount?: number | null
          expected_amount?: number | null
          difference?: number | null
          status?: string
          notes?: string | null
        }
        Relationships: [{
          foreignKeyName: 'cash_movements_session_id_fkey'
          columns: ['session_id']
          isOneToOne: false
          referencedRelation: 'cash_sessions'
          referencedColumns: ['id']
        }]
      }
      cash_movements: {
        Row: {
          id: string
          session_id: string
          type: string
          amount: number
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          type: string
          amount: number
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          type?: string
          amount?: number
          description?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_sale_id_fkey'
            columns: ['sale_id']
            isOneToOne: false
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'businesses'
            referencedColumns: ['id']
          },
        ]
      }
      invoices: {
        Row: {
          id: string
          sale_id: string
          business_id: string
          invoice_type: string
          cbte_tipo: number
          invoice_number: number
          punto_venta: number
          doc_tipo: number
          doc_nro: string | null
          customer_name: string | null
          iva_condition_customer: string | null
          neto_gravado: number
          neto_no_gravado: number
          exento: number
          iva_amount: number
          tributos: number
          subtotal: number
          total: number
          cae: string | null
          cae_expiry: string | null
          afip_request: string | null
          afip_response: string | null
          voided: boolean
          credit_note_for: string | null
          status: string
          pdf_path: string | null
          customer_address: string | null
          env: string
          created_at: string
        }
        Insert: {
          id?: string
          sale_id: string
          business_id: string
          invoice_type: string
          cbte_tipo?: number
          invoice_number?: number
          punto_venta?: number
          doc_tipo?: number
          doc_nro?: string | null
          customer_name?: string | null
          iva_condition_customer?: string | null
          neto_gravado?: number
          neto_no_gravado?: number
          exento?: number
          iva_amount?: number
          tributos?: number
          subtotal?: number
          total?: number
          cae?: string | null
          cae_expiry?: string | null
          afip_request?: string | null
          afip_response?: string | null
          voided?: boolean
          credit_note_for?: string | null
          status?: string
          pdf_path?: string | null
          customer_address?: string | null
          env?: string
          created_at?: string
        }
        Update: {
          id?: string
          sale_id?: string
          business_id?: string
          invoice_type?: string
          cbte_tipo?: number
          invoice_number?: number
          punto_venta?: number
          doc_tipo?: number
          doc_nro?: string | null
          customer_name?: string | null
          iva_condition_customer?: string | null
          neto_gravado?: number
          neto_no_gravado?: number
          exento?: number
          iva_amount?: number
          tributos?: number
          subtotal?: number
          total?: number
          cae?: string | null
          cae_expiry?: string | null
          afip_request?: string | null
          afip_response?: string | null
          voided?: boolean
          credit_note_for?: string | null
          status?: string
          pdf_path?: string | null
          customer_address?: string | null
          env?: string
          created_at?: string
        }
        Relationships: [{
          foreignKeyName: 'customer_payments_customer_id_fkey'
          columns: ['customer_id']
          isOneToOne: false
          referencedRelation: 'customers'
          referencedColumns: ['id']
        }]
      }
      customer_payments: {
        Row: {
          id: string
          business_id: string
          customer_id: string
          amount: number
          payment_method: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          customer_id: string
          amount: number
          payment_method?: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          customer_id?: string
          amount?: number
          payment_method?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: [{
          foreignKeyName: 'invoice_items_invoice_id_fkey'
          columns: ['invoice_id']
          isOneToOne: false
          referencedRelation: 'invoices'
          referencedColumns: ['id']
        }]
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          product_id: string | null
          description: string
          qty: number
          unit_price: number
          iva_rate: number
          total: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          product_id?: string | null
          description: string
          qty: number
          unit_price: number
          iva_rate?: number
          total: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          product_id?: string | null
          description?: string
          qty?: number
          unit_price?: number
          iva_rate?: number
          total?: number
          created_at?: string
        }
        Relationships: []
      }
      fiscal_settings: {
        Row: {
          id: string
          business_id: string
          env: string
          cuit: string
          razon_social: string
          domicilio: string
          iva_condition: string
          pto_vta: number
          cert_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          env?: string
          cuit: string
          razon_social: string
          domicilio: string
          iva_condition: string
          pto_vta?: number
          cert_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          env?: string
          cuit?: string
          razon_social?: string
          domicilio?: string
          iva_condition?: string
          pto_vta?: number
          cert_status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      fiscal_keys: {
        Row: {
          id: string
          business_id: string
          env: string
          private_key_enc: string
          csr_pem: string
          crt_pem: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          env?: string
          private_key_enc: string
          csr_pem: string
          crt_pem?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          env?: string
          private_key_enc?: string
          csr_pem?: string
          crt_pem?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_accounts: {
        Row: {
          id: string
          business_id: string
          customer_id: string
          credit_limit: number
          balance: number
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          customer_id: string
          credit_limit?: number
          balance?: number
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          customer_id?: string
          credit_limit?: number
          balance?: number
          updated_at?: string
        }
        Relationships: [{
          foreignKeyName: 'customer_accounts_customer_id_fkey'
          columns: ['customer_id']
          isOneToOne: false
          referencedRelation: 'customers'
          referencedColumns: ['id']
        }]
      }
      account_movements: {
        Row: {
          id: string
          business_id: string
          customer_id: string
          type: string
          amount: number
          sale_id: string | null
          note: string | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          customer_id: string
          type: string
          amount: number
          sale_id?: string | null
          note?: string | null
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          customer_id?: string
          type?: string
          amount?: number
          sale_id?: string | null
          note?: string | null
          user_id?: string | null
          created_at?: string
        }
        Relationships: [{
          foreignKeyName: 'account_movements_customer_id_fkey'
          columns: ['customer_id']
          isOneToOne: false
          referencedRelation: 'customers'
          referencedColumns: ['id']
        }]
      }
      notifications: {
        Row: {
          id: string
          business_id: string
          type: string
          title: string
          message: string
          severity: string
          action_url: string | null
          reference_id: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          type: string
          title: string
          message: string
          severity?: string
          action_url?: string | null
          reference_id?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          type?: string
          title?: string
          message?: string
          severity?: string
          action_url?: string | null
          reference_id?: string | null
          is_read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      daily_summaries: {
        Row: {
          id: string
          business_id: string
          date: string
          total_sales: number
          sales_count: number
          total_cost: number
          total_profit: number
          top_product_name: string | null
          top_product_qty: number | null
          cash_opened_at: string | null
          cash_closed_at: string | null
          payment_breakdown: Json
          payload: Json
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          date: string
          total_sales?: number
          sales_count?: number
          total_cost?: number
          total_profit?: number
          top_product_name?: string | null
          top_product_qty?: number | null
          cash_opened_at?: string | null
          cash_closed_at?: string | null
          payment_breakdown?: Json
          payload?: Json
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          date?: string
          total_sales?: number
          sales_count?: number
          total_cost?: number
          total_profit?: number
          top_product_name?: string | null
          top_product_qty?: number | null
          cash_opened_at?: string | null
          cash_closed_at?: string | null
          payment_breakdown?: Json
          payload?: Json
          created_at?: string
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          id: string
          business_id: string
          filename: string | null
          mode: string
          total_rows: number | null
          created: number | null
          updated: number | null
          skipped: number | null
          errors_json: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          filename?: string | null
          mode?: string
          total_rows?: number | null
          created?: number | null
          updated?: number | null
          skipped?: number | null
          errors_json?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          filename?: string | null
          mode?: string
          total_rows?: number | null
          created?: number | null
          updated?: number | null
          skipped?: number | null
          errors_json?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          id: string
          code: string
          referrer_business_id: string
          referred_business_id: string
          referrer_rewarded: boolean
          referred_rewarded: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          referrer_business_id: string
          referred_business_id: string
          referrer_rewarded?: boolean
          referred_rewarded?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          referrer_business_id?: string
          referred_business_id?: string
          referrer_rewarded?: boolean
          referred_rewarded?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'referrals_referrer_business_id_fkey'
            columns: ['referrer_business_id']
            isOneToOne: false
            referencedRelation: 'businesses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'referrals_referred_business_id_fkey'
            columns: ['referred_business_id']
            isOneToOne: true
            referencedRelation: 'businesses'
            referencedColumns: ['id']
          },
        ]
      }
      music_tracks: {
        Row: {
          id: string
          title: string
          artist: string | null
          genre: string | null
          mood: string | null
          duration_seconds: number | null
          cover_path: string | null
          audio_path: string
          mime: string
          size_bytes: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          artist?: string | null
          genre?: string | null
          mood?: string | null
          duration_seconds?: number | null
          cover_path?: string | null
          audio_path: string
          mime?: string
          size_bytes?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          artist?: string | null
          genre?: string | null
          mood?: string | null
          duration_seconds?: number | null
          cover_path?: string | null
          audio_path?: string
          mime?: string
          size_bytes?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      music_playlists: {
        Row: {
          id: string
          business_id: string | null
          name: string
          description: string | null
          cover_path: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          name: string
          description?: string | null
          cover_path?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string | null
          name?: string
          description?: string | null
          cover_path?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [{
          foreignKeyName: 'music_playlists_business_id_fkey'
          columns: ['business_id']
          isOneToOne: false
          referencedRelation: 'businesses'
          referencedColumns: ['id']
        }]
      }
      music_playlist_items: {
        Row: {
          id: string
          playlist_id: string
          track_id: string
          position: number
        }
        Insert: {
          id?: string
          playlist_id: string
          track_id: string
          position: number
        }
        Update: {
          id?: string
          playlist_id?: string
          track_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: 'music_playlist_items_playlist_id_fkey'
            columns: ['playlist_id']
            isOneToOne: false
            referencedRelation: 'music_playlists'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'music_playlist_items_track_id_fkey'
            columns: ['track_id']
            isOneToOne: false
            referencedRelation: 'music_tracks'
            referencedColumns: ['id']
          },
        ]
      }
      music_playback_state: {
        Row: {
          business_id: string
          active_playlist_id: string | null
          current_track_id: string | null
          current_time_sec: number
          volume: number
          is_muted: boolean
          is_playing: boolean
          shuffle: boolean
          repeat_mode: string
          updated_at: string
        }
        Insert: {
          business_id: string
          active_playlist_id?: string | null
          current_track_id?: string | null
          current_time_sec?: number
          volume?: number
          is_muted?: boolean
          is_playing?: boolean
          shuffle?: boolean
          repeat_mode?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          active_playlist_id?: string | null
          current_track_id?: string | null
          current_time_sec?: number
          volume?: number
          is_muted?: boolean
          is_playing?: boolean
          shuffle?: boolean
          repeat_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'music_playback_state_business_id_fkey'
            columns: ['business_id']
            isOneToOne: true
            referencedRelation: 'businesses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'music_playback_state_active_playlist_id_fkey'
            columns: ['active_playlist_id']
            isOneToOne: false
            referencedRelation: 'music_playlists'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'music_playback_state_current_track_id_fkey'
            columns: ['current_track_id']
            isOneToOne: false
            referencedRelation: 'music_tracks'
            referencedColumns: ['id']
          },
        ]
      }
      business_music_access: {
        Row: {
          business_id: string
          enabled: boolean
          plan_tier: string
          created_at: string
        }
        Insert: {
          business_id: string
          enabled?: boolean
          plan_tier?: string
          created_at?: string
        }
        Update: {
          business_id?: string
          enabled?: boolean
          plan_tier?: string
          created_at?: string
        }
        Relationships: [{
          foreignKeyName: 'business_music_access_business_id_fkey'
          columns: ['business_id']
          isOneToOne: true
          referencedRelation: 'businesses'
          referencedColumns: ['id']
        }]
      }
      payment_requests: {
        Row: {
          id: string
          business_id: string
          user_id: string
          amount: string
          proof_url: string | null
          status: string
          note: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          user_id: string
          amount?: string
          proof_url?: string | null
          status?: string
          note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          user_id?: string
          amount?: string
          proof_url?: string | null
          status?: string
          note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      stock_insights: {
        Row: {
          id: string | null
          business_id: string | null
          name: string | null
          stock: number | null
          stock_min: number | null
          unit: string | null
          purchase_price: number | null
          sale_price: number | null
          stock_status: string | null
          avg_daily_sales_30d: number | null
          last_sale_at: string | null
        }
        Relationships: [{
          foreignKeyName: 'payment_requests_business_id_fkey'
          columns: ['business_id']
          isOneToOne: false
          referencedRelation: 'businesses'
          referencedColumns: ['id']
        }]
      }
    }
    Functions: {
      generate_notifications: { Args: { p_business_id: string }; Returns: undefined }
      generate_daily_summary: { Args: { p_business_id: string; p_date?: string }; Returns: Json }
      apply_account_payment: {
        Args: { p_business_id: string; p_customer_id: string; p_amount: number; p_note?: string | null; p_user_id?: string | null }
        Returns: Json
      }
      charge_customer_account: {
        Args: { p_business_id: string; p_customer_id: string; p_amount: number; p_sale_id?: string | null; p_note?: string | null; p_user_id?: string | null }
        Returns: Json
      }
      top_selling_products: {
        Args: { p_business_id: string; p_days?: number; p_limit?: number }
        Returns: { product_id: string; product_name: string; total_qty: number; total_revenue: number }[]
      }
      frequently_bought_together: {
        Args: { p_business_id: string; p_product_id: string; p_limit?: number }
        Returns: { product_id: string; product_name: string; co_count: number }[]
      }
      ensure_referral_code: { Args: { p_business_id: string }; Returns: string }
      redeem_referral_code: { Args: { p_code: string; p_business_id: string }; Returns: Json }
      get_linked_businesses: { Args: Record<string, never>; Returns: { id: string; name: string }[] }
      extend_linked_subscriptions: { Args: Record<string, never>; Returns: undefined }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

/* ----------------------------------------------------------------
   Exported row types (convenience aliases)
   ---------------------------------------------------------------- */
export type Business = Database['public']['Tables']['businesses']['Row']
export type UserProfile = Database['public']['Tables']['users']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Supplier = Database['public']['Tables']['suppliers']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']
export type Sale = Database['public']['Tables']['sales']['Row']
export type SaleItem = Database['public']['Tables']['sale_items']['Row']
export type SalePayment = Database['public']['Tables']['sale_payments']['Row']
export type StockMovement = Database['public']['Tables']['stock_movements']['Row']
export type Purchase = Database['public']['Tables']['purchases']['Row']
export type PurchaseItem = Database['public']['Tables']['purchase_items']['Row']
export type CashSession = Database['public']['Tables']['cash_sessions']['Row']
export type CashMovement = Database['public']['Tables']['cash_movements']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type CustomerPayment = Database['public']['Tables']['customer_payments']['Row']
export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']

/* ----------------------------------------------------------------
   Presupuestos (documento no fiscal)
   ---------------------------------------------------------------- */

export type QuoteStatus = 'pending' | 'accepted' | 'rejected' | 'expired'

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Vencido',
}

export interface Quote {
  id: string
  business_id: string
  quote_number: number
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  status: QuoteStatus
  subtotal: number
  discount: number
  total: number
  valid_until: string | null
  notes: string | null
  sale_id: string | null
  seller_id: string | null
  created_at: string
}

export interface QuoteItem {
  id: string
  quote_id: string
  product_id: string | null
  description: string
  quantity: number
  price: number
  created_at: string
}

/* ----------------------------------------------------------------
   NEW v6 TABLES
   ---------------------------------------------------------------- */

export interface CustomerAccount {
  id: string
  business_id: string
  customer_id: string
  credit_limit: number
  balance: number
  updated_at: string
}

export interface AccountMovement {
  id: string
  business_id: string
  customer_id: string
  type: 'charge' | 'payment' | 'adjust'
  amount: number
  sale_id: string | null
  note: string | null
  user_id: string | null
  created_at: string
}

export type NotificationSeverity = 'info' | 'warn' | 'danger'
export type NotificationType =
  | 'low_stock'
  | 'no_cost'
  | 'high_debt'
  | 'caja'
  | 'summary'
  | 'custom'

export interface AppNotification {
  id: string
  business_id: string
  type: NotificationType
  title: string
  message: string
  severity: NotificationSeverity
  action_url: string | null
  reference_id: string | null
  is_read: boolean
  created_at: string
}

export interface DailySummary {
  id: string
  business_id: string
  date: string
  total_sales: number
  sales_count: number
  total_cost: number
  total_profit: number
  top_product_name: string | null
  top_product_qty: number | null
  cash_opened_at: string | null
  cash_closed_at: string | null
  payment_breakdown: Record<string, number>
  payload: Record<string, unknown>
  created_at: string
}

export type StockStatus = 'ok' | 'low' | 'critical'

export interface StockInsight {
  id: string
  business_id: string
  name: string
  stock: number
  stock_min: number
  unit: string
  purchase_price: number
  sale_price: number
  stock_status: StockStatus
  avg_daily_sales_30d: number
  last_sale_at: string | null
}

export interface TopSellingProduct {
  product_id: string
  product_name: string
  total_qty: number
  total_revenue: number
}

export interface FrequentlyBoughtTogether {
  product_id: string
  product_name: string
  co_count: number
}

export type FiscalEnv = 'homo' | 'prod'
export type CertStatus = 'missing' | 'csr_generated' | 'crt_uploaded' | 'connected'

// Strong-typed fiscal interfaces with literal unions
export interface FiscalSettings {
  id: string
  business_id: string
  env: FiscalEnv
  cuit: string
  razon_social: string
  domicilio: string
  iva_condition: string
  pto_vta: number
  cert_status: CertStatus
  created_at: string
  updated_at: string
}

export interface FiscalKeys {
  id: string
  business_id: string
  env: FiscalEnv
  private_key_enc: string
  csr_pem: string
  crt_pem: string | null
  created_at: string
  updated_at: string
}

/* ----------------------------------------------------------------
   POS Cart types
   ---------------------------------------------------------------- */
export interface CartItem {
  product: Product
  quantity: number
  price: number
}

/* ----------------------------------------------------------------
   AFIP constants
   ---------------------------------------------------------------- */
export const IVA_CONDITIONS = [
  { id: 'responsable_inscripto', label: 'Responsable Inscripto' },
  { id: 'monotributo', label: 'Monotributista' },
  { id: 'exento', label: 'Exento' },
  { id: 'consumidor_final', label: 'Consumidor Final' },
] as const

export const DOC_TIPOS = [
  { id: 80, code: 'CUIT', label: 'CUIT' },
  { id: 86, code: 'CUIL', label: 'CUIL' },
  { id: 96, code: 'DNI', label: 'DNI' },
  { id: 99, code: 'SIN', label: 'Sin identificar' },
] as const

/** AFIP cbte_tipo codes */
export const CBTE_TIPOS = {
  factura_a: 1,
  nota_debito_a: 2,
  nota_credito_a: 3,
  factura_b: 6,
  nota_debito_b: 7,
  nota_credito_b: 8,
  factura_c: 11,
  nota_debito_c: 12,
  nota_credito_c: 13,
} as const

export const IVA_RATE = 0.21
