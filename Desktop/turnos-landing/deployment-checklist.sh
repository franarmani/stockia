#!/bin/bash

# ===============================================
# 🚀 PRE-DEPLOYMENT CHECKLIST SCRIPT
# ===============================================
# Ejecutar: bash deployment-checklist.sh

set -e  # Exit on error

echo "🔍 PRE-DEPLOYMENT CHECKLIST"
echo "============================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. Verificar Node.js
echo "1. Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    check_pass "Node.js instalado: $NODE_VERSION"
else
    check_fail "Node.js no instalado"
    exit 1
fi

# 2. Verificar npm/pnpm
echo ""
echo "2. Verificando package manager..."
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    check_pass "pnpm instalado: $PNPM_VERSION"
elif command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    check_pass "npm instalado: $NPM_VERSION"
else
    check_fail "npm o pnpm no instalados"
    exit 1
fi

# 3. Verificar Git
echo ""
echo "3. Verificando Git..."
if command -v git &> /dev/null; then
    GIT_VERSION=$(git -v)
    check_pass "Git instalado: $GIT_VERSION"
else
    check_fail "Git no instalado"
    exit 1
fi

# 4. Verificar estructura de carpetas
echo ""
echo "4. Verificando estructura..."
ERRORS=0

if [ -d "packages/backend" ]; then
    check_pass "Backend folder encontrado"
else
    check_fail "Backend folder no encontrado"
    ERRORS=$((ERRORS + 1))
fi

if [ -d "packages/frontend" ]; then
    check_pass "Frontend folder encontrado"
else
    check_fail "Frontend folder no encontrado"
    ERRORS=$((ERRORS + 1))
fi

# 5. Verificar archivos clave
echo ""
echo "5. Verificando archivos clave..."

# Backend
if [ -f "packages/backend/package.json" ]; then
    check_pass "Backend package.json existe"
else
    check_fail "Backend package.json falta"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "packages/backend/.env.example" ]; then
    check_pass "Backend .env.example existe"
else
    check_warn "Backend .env.example falta - creándolo"
fi

# Frontend
if [ -f "packages/frontend/package.json" ]; then
    check_pass "Frontend package.json existe"
else
    check_fail "Frontend package.json falta"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "packages/frontend/.env.example" ]; then
    check_pass "Frontend .env.example existe"
else
    check_warn "Frontend .env.example falta - creándolo"
fi

# 6. Verificar dependencias instaladas
echo ""
echo "6. Verificando dependencias..."

# Backend
if [ -d "packages/backend/node_modules" ]; then
    check_pass "Backend dependencies instaladas"
else
    check_warn "Backend node_modules no encontrado - ejecutar pnpm install en backend"
fi

# Frontend
if [ -d "packages/frontend/node_modules" ]; then
    check_pass "Frontend dependencies instaladas"
else
    check_warn "Frontend node_modules no encontrado - ejecutar pnpm install en frontend"
fi

# 7. Verificar .gitignore
echo ""
echo "7. Verificando .gitignore..."

GITIGNORE_ISSUES=0

if grep -q "\.env" .gitignore 2>/dev/null; then
    check_pass ".env está en .gitignore"
else
    check_fail ".env NO está en .gitignore (RIESGO DE SEGURIDAD)"
    GITIGNORE_ISSUES=$((GITIGNORE_ISSUES + 1))
fi

if grep -q "node_modules" .gitignore 2>/dev/null; then
    check_pass "node_modules está en .gitignore"
else
    check_fail "node_modules NO está en .gitignore"
    GITIGNORE_ISSUES=$((GITIGNORE_ISSUES + 1))
fi

# 8. Verificar Git
echo ""
echo "8. Verificando repositorio Git..."

if [ -d ".git" ]; then
    check_pass "Git repository inicializado"
    
    if git remote -v | grep -q "origin"; then
        REMOTE=$(git remote get-url origin)
        check_pass "Remote 'origin' configurado: $REMOTE"
    else
        check_fail "Remote 'origin' no configurado"
        ERRORS=$((ERRORS + 1))
    fi
else
    check_fail "Git repository no inicializado"
    ERRORS=$((ERRORS + 1))
fi

# 9. Summary
echo ""
echo "============================"
echo "📊 RESUMEN DEL CHEQUEO"
echo "============================"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ LISTO PARA DEPLOYMENT${NC}"
    echo ""
    echo "Próximos pasos:"
    echo "1. Actualizar .env files con variables de producción"
    echo "2. Hacer push a GitHub: git push origin main"
    echo "3. Conectar a Railway y Vercel"
    echo "4. Configurar variables de entorno en plataformas"
    echo "5. Disparar deployment"
    exit 0
else
    echo -e "${RED}❌ ERRORES ENCONTRADOS: $ERRORS${NC}"
    echo ""
    echo "Por favor, soluciona los errores arriba antes de desplegar"
    exit 1
fi
