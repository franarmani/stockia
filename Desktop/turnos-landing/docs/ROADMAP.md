# 🗺️ Roadmap - Desarrollo del SaaS Turnos

## Fase 1: Foundation ✅ (COMPLETO HOY)

- [x] Arquitectura multi-tenant definida
- [x] Modelo de BD completo (PostgreSQL)
- [x] Setup NestJS backend
- [x] Setup Next.js frontend
- [x] Docker Compose para dev
- [x] Variables de entorno configurables
- [x] Documentación inicial

**Tiempo estimado**: 3-4 horas completadas

---

## Fase 2: Autenticación & Registro (PRÓXIMA)

**Duración estimada**: 6-8 horas

### Backend
- [ ] Module AuthService (login, register, JWT)
- [ ] GuardsDecorators (@UseGuards, @Public)
- [ ] Entidad User + relaciones
- [ ] Entidad Company inicial
- [ ] Password hashing (bcryptjs)
- [ ] Refresh tokens
- [ ] Email verification (opcional v1)

### Frontend
- [ ] Página de registro (/register)
- [ ] Página de login (/login)
- [ ] Auth store (Zustand)
- [ ] Protected routes
- [ ] Remember me (cookies)
- [ ] Validación de formularios

### Testing
- [ ] Test de registro
- [ ] Test de login
- [ ] Test de JWT validation

**Deliverable**: Empresas pueden registrarse y entrar a su cuenta

---

## Fase 3: Landing Page (Marketing)

**Duración estimada**: 8-10 horas

### Diseño & Copywriting
- [ ] Hero section con CTA
- [ ] Sección de beneficios
- [ ] Cómo funciona (3-4 pasos)
- [ ] Rubros compatibles
- [ ] Planes y precios
- [ ] Testimonios (fake pero atractivos)
- [ ] FAQ
- [ ] Footer + legal

### Conversión
- [ ] Lead magnet (email list)
- [ ] Integración Mailchimp / SendGrid
- [ ] Analytics (Google Analytics)
- [ ] Meta tags SEO

### UI/UX
- [ ] Responsive en mobile
- [ ] Dark mode (opcional)
- [ ] Animaciones Framer Motion
- [ ] Botón "Probar gratis"

**Deliverable**: Landing page profesional que venda el SaaS

---

## Fase 4: Dashboard Core

**Duración estimada**: 12-15 horas

### 4.1 Agenda / Calendario
- [ ] Vista diaria
- [ ] Vista semanal
- [ ] Vista mensual
- [ ] Arrastrar y soltar turnos
- [ ] Crear turno manual
- [ ] Editar turno
- [ ] Cancelar turno
- [ ] Estados (pending, confirmed, completed, no_show)
- [ ] Notificaciones con badge

### 4.2 Clientes
- [ ] Listado con búsqueda
- [ ] Crear cliente
- [ ] Ver historial de turnos
- [ ] Estadísticas (gasto total, última cita)
- [ ] Botón WhatsApp directo
- [ ] Borrar cliente (soft delete)

### 4.3 Servicios
- [ ] CRUD servicios
- [ ] Precio y duración
- [ ] Tipo (presencial, online, domicilio)
- [ ] Seña configurable
- [ ] Descripción con editor rich text
- [ ] Imagen del servicio
- [ ] Asignar profesionales

### 4.4 Personal/Empleados
- [ ] Alta de profesionales
- [ ] Horarios por día
- [ ] Servicios que realiza
- [ ] Estado (activo/inactivo)
- [ ] Editar datos
- [ ] Eliminar

### 4.5 Configuración
- [ ] Logo de empresa
- [ ] Datos básicos
- [ ] Horarios generales
- [ ] Políticas (cancelación, seña)
- [ ] ON/OFF página pública
- [ ] Tema de color
- [ ] Idioma

**Deliverable**: Panel funcional donde gestionar el negocio

---

## Fase 5: Página Pública de Reservas

**Duración estimada**: 6-8 horas

### Funcionalidades
- [ ] URL pública: /book/{company_slug}
- [ ] Selector de servicio
- [ ] Selector de profesional
- [ ] Calendar picker de fechas
- [ ] Horarios disponibles
- [ ] Formulario cliente (nombre, teléfono, email)
- [ ] Confirmación de reserva
- [ ] Email de confirmación al cliente
- [ ] SMS/WhatsApp automático

### Seguridad
- [ ] reCAPTCHA
- [ ] Rate limiting
- [ ] Validación de datos
- [ ] No SQL injection

**Deliverable**: Clientes pueden reservar online directamente

---

## Fase 6: Sistema de Pagos & Suscripciones

**Duración estimada**: 10-12 horas

### Planes
- [ ] Plan FREE (limitado: 5 servicios, 2 empleados, 50 turnos/mes)
- [ ] Plan BASIC ($29/mes: 20 servicios, 5 empleados, 500 turnos/mes)
- [ ] Plan PRO ($99/mes: ilimitado)

### Integraciones de Pago
- [ ] MercadoPago (recomendado para LATAM)
- [ ] O Stripe (global)
- [ ] Webhook para confirmación
- [ ] Renovación automática

### Dashboard de Suscripción
- [ ] Ver plan actual
- [ ] Fecha de vencimiento
- [ ] Upgrade/Downgrade
- [ ] Historial de pagos
- [ ] Facturación

### Control de Acceso
- [ ] Bloqueo si plan expirado
- [ ] Validar límites por plan
- [ ] Contador de recursos usados

**Deliverable**: Monetización funcional del SaaS

---

## Fase 7: Notificaciones

**Duración estimada**: 6-8 horas

### Email
- [ ] Confirmación de registro
- [ ] Confirmación de reserva
- [ ] Recordatorio 24hs antes
- [ ] Templates HTML profesionales
- [ ] Unsubscribe link

### SMS/WhatsApp
- [ ] Integración Twilio
- [ ] Mensaje de confirmación
- [ ] Recordatorio 2hs antes
- [ ] Link para confirmar asistencia

### Push Notifications (opcional)
- [ ] Notificaciones en navegador
- [ ] Para admin alertas de reservas

**Deliverable**: Clientes reciben confirmaciones automáticas

---

## Fase 8: Reportes & Analytics

**Duración estimada**: 6-8 horas

### Reportes
- [ ] Ingresos mensuales
- [ ] Turnos por servicio
- [ ] Clientes más frecuentes
- [ ] Ocupación de profesionales
- [ ] Exportar PDF/Excel

### Gráficos
- [ ] Gráfico de ingresos
- [ ] Ocupación timeline
- [ ] Distribución de servicios
- [ ] Crecimiento de clientes

**Deliverable**: Empresa puede analizar su negocio

---

## Fase 9: Integraciones Externas

**Duración estimada**: 8-10 horas

### Google Calendar
- [ ] Sincronizar turnos a Google Calendar
- [ ] Webhooks bidireccionales

### WhatsApp Business
- [ ] API official de WhatsApp
- [ ] Mensajes templados

### Instagram / Facebook
- [ ] Botón de reserva en perfil

### QR / Links cortos
- [ ] Generar QR para reservar
- [ ] Links personalizados por servicio

**Deliverable**: Múltiples canales de reserva

---

## Fase 10: Polish & Deployment

**Duración estimada**: 8-10 horas

### Frontend
- [ ] Optimización performance
- [ ] Code splitting
- [ ] Lazy loading imágenes
- [ ] SEO meta tags
- [ ] Error boundaries
- [ ] Skeleton loaders

### Backend
- [ ] Validación de inputs robusta
- [ ] Error handling
- [ ] Logging centralizado (Sentry)
- [ ] Rate limiting robusto
- [ ] CORS configurado

### Testing
- [ ] Tests unitarios
- [ ] Tests e2e críticos
- [ ] Load testing
- [ ] Security audit

### Deployment
- [ ] Setup CI/CD (GitHub Actions)
- [ ] Ambiente staging
- [ ] Variábles de producción
- [ ] Backup automático
- [ ] SSL/HTTPS
- [ ] CDN para static assets

**Deliverable**: SaaS listo para producción

---

## Timeline Total Estimado

| Fase | Duración | Estado |
|------|----------|--------|
| 1 - Foundation | 3-4h | ✅ Hoy |
| 2 - Auth | 6-8h | 🔄 Próxima |
| 3 - Landing | 8-10h | ⏳ Después |
| 4 - Dashboard | 12-15h | ⏳ |
| 5 - Página Pública | 6-8h | ⏳ |
| 6 - Pagos | 10-12h | ⏳ |
| 7 - Notificaciones | 6-8h | ⏳ |
| 8 - Reportes | 6-8h | ⏳ |
| 9 - Integraciones | 8-10h | ⏳ |
| 10 - Polish | 8-10h | ⏳ |
| **TOTAL** | **~80-100 horas** | |

---

## Próximo Paso Recomendado

### 👉 Fase 2: Autenticación & Registro

Razón:
1. Sin auth, nada funciona
2. Es la base para multi-tenancy
3. Relativo rápido implementar
4. Debloquea el resto del desarrollo

**Comando para comenzar**:
```bash
# Cuando estés listo:
# "Ahora armá el sistema de autenticación y registro de empresas"
```

---

¿Algo que ajustar en el plan? 🚀
