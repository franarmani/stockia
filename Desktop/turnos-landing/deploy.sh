#!/bin/bash

# ===============================================
# 🚀 DEPLOYMENT AUTOMATION SCRIPT
# ===============================================
# Ejecutar: bash deploy.sh

set -e  # Exit on error

echo "🚀 TUTURNO DEPLOYMENT AUTOMATION"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. Verificar cambios no commiteados
echo "1️⃣  Verificando repositorio..."
if [ -n "$(git status --porcelain)" ]; then
    log_warn "Hay cambios sin commit:"
    git status --short
    echo ""
    read -p "¿Continuar? (s/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        log_error "Deployment cancelado"
        exit 1
    fi
fi

# 2. Verificar rama
echo ""
echo "2️⃣  Verificando rama Git..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
log_info "Rama actual: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    log_warn "No estás en main/master"
    read -p "¿Cambiar a main? (s/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        git checkout main || git checkout master
        log_success "Cambió a rama principal"
    fi
fi

# 3. Instalar dependencias
echo ""
echo "3️⃣  Instalando dependencias..."

if [ -d "packages/backend/node_modules" ]; then
    log_info "Backend dependencies ya existen"
else
    log_info "Instalando backend dependencies..."
    cd packages/backend
    pnpm install || npm install
    cd ../..
    log_success "Backend instalado"
fi

if [ -d "packages/frontend/node_modules" ]; then
    log_info "Frontend dependencies ya existen"
else
    log_info "Instalando frontend dependencies..."
    cd packages/frontend
    pnpm install || npm install
    cd ../..
    log_success "Frontend instalado"
fi

# 4. Build Backend
echo ""
echo "4️⃣  Building backend..."
cd packages/backend
if npm run build; then
    log_success "Backend build exitoso"
else
    log_error "Backend build falló"
    cd ../..
    exit 1
fi
cd ../..

# 5. Build Frontend
echo ""
echo "5️⃣  Building frontend..."
cd packages/frontend
if npm run build; then
    log_success "Frontend build exitoso"
else
    log_error "Frontend build falló"
    cd ../..
    exit 1
fi
cd ../..

# 6. Type checking
echo ""
echo "6️⃣  Verificando tipos..."

if command -v tsc &> /dev/null; then
    if npm run type-check 2>/dev/null; then
        log_success "Type check pasó"
    else
        log_warn "Type check tuvo warnings (no bloqueante)"
    fi
else
    log_warn "TypeScript no instalado globalmente"
fi

# 7. Linting
echo ""
echo "7️⃣  Verificando lint..."

if npm run lint 2>/dev/null; then
    log_success "Lint check pasó"
else
    log_warn "Lint tuvo warnings (no bloqueante)"
fi

# 8. Commit cambios
echo ""
echo "8️⃣  Preparando commit..."

if [ -n "$(git status --porcelain)" ]; then
    log_info "Cambios detectados"
    git add .
    git commit -m "🚀 Deploy - $(date '+%Y-%m-%d %H:%M:%S')" || log_warn "Nada que commitear"
fi

# 9. Push a GitHub
echo ""
echo "9️⃣  Pusheando a GitHub..."

if git push origin $(git rev-parse --abbrev-ref HEAD); then
    log_success "Push a GitHub exitoso"
else
    log_error "Push a GitHub falló"
    exit 1
fi

# 10. Resumen
echo ""
echo "===================================="
echo "📊 DEPLOYMENT CHECKLIST COMPLETO"
echo "===================================="
echo ""
echo -e "${GREEN}✅ Codigo listo para deploy${NC}"
echo ""
echo "Próximos pasos:"
echo "1. Ir a https://railway.app y verificar deployment"
echo "2. Ir a https://vercel.com y verificar deployment"
echo "3. Esperar 5-10 minutos para builds completos"
echo "4. Prueba: curl https://api.tuturno.app/health"
echo "5. Abre: https://tuturno.app"
echo ""
echo "Deployment automático iniciado 🚀"
echo ""

# 11. Notificación opcional
if command -v notify-send &> /dev/null; then
    notify-send "Tuturno Deploy" "Code pusheado a GitHub. Verifica Railway y Vercel."
fi

log_success "¡Todo listo!"
