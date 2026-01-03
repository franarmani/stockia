#!/bin/bash
# 🚀 DEPLOYMENT VERIFICATION SCRIPT
# Verifica que todo esté listo para deploy

echo "==================================="
echo "🔍 VERIFICANDO SETUP DE DEPLOYMENT"
echo "==================================="
echo ""

# 1. Verificar Node.js
echo "1️⃣ Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✅ Node.js instalado: $NODE_VERSION"
else
    echo "❌ Node.js NO instalado"
fi

# 2. Verificar npm/pnpm
echo ""
echo "2️⃣ Verificando Package Manager..."
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    echo "✅ pnpm instalado: $PNPM_VERSION"
elif command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo "✅ npm instalado: $NPM_VERSION"
else
    echo "❌ npm/pnpm NO instalados"
fi

# 3. Verificar Git
echo ""
echo "3️⃣ Verificando Git..."
if command -v git &> /dev/null; then
    GIT_VERSION=$(git -v)
    echo "✅ Git instalado: $GIT_VERSION"
    echo "   Usuario: $(git config user.name)"
    echo "   Email: $(git config user.email)"
else
    echo "❌ Git NO instalado"
fi

# 4. Verificar estructura
echo ""
echo "4️⃣ Verificando estructura del proyecto..."
if [ -d "packages/backend" ]; then
    echo "✅ Carpeta packages/backend existe"
else
    echo "❌ packages/backend NO existe"
fi

if [ -d "packages/frontend" ]; then
    echo "✅ Carpeta packages/frontend existe"
else
    echo "❌ packages/frontend NO existe"
fi

# 5. Verificar archivos clave
echo ""
echo "5️⃣ Verificando archivos clave..."

files_to_check=(
    "packages/backend/package.json"
    "packages/backend/railway.json"
    "packages/backend/.env.example"
    "packages/frontend/package.json"
    "packages/frontend/vercel.json"
    "packages/frontend/.env.example"
    "pnpm-workspace.yaml"
)

for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file NO encontrado"
    fi
done

# 6. Verificar Git Remote
echo ""
echo "6️⃣ Verificando Git Remote..."
REMOTE=$(git remote -v)
if [ -z "$REMOTE" ]; then
    echo "⚠️  NO hay remote configurado"
    echo "   Ejecuta: git remote add origin https://github.com/franarmani/turnos-landing.git"
else
    echo "✅ Git Remote configurado:"
    echo "$REMOTE"
fi

# 7. Verificar rama
echo ""
echo "7️⃣ Verificando rama Git..."
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "   Rama actual: $BRANCH"
if [ "$BRANCH" == "main" ] || [ "$BRANCH" == "master" ]; then
    echo "✅ Rama correcta"
else
    echo "⚠️  Rama no es main/master"
fi

# 8. Verificar commits
echo ""
echo "8️⃣ Verificando commits..."
COMMITS=$(git rev-list --all --count)
echo "✅ Total commits: $COMMITS"

# 9. Resumen
echo ""
echo "==================================="
echo "✨ VERIFICACIÓN COMPLETADA"
echo "==================================="
echo ""
echo "Próximo paso: DEPLOYMENT_RAILWAY_VERCEL.md"
echo ""
