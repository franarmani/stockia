# 🔧 Configuración de Java para React Native

## ⚠️ Problema Detectado
Tu proyecto requiere Java 11+ pero tu sistema tiene Java 8 instalado.

## 🎯 Solución
1. **Instalar OpenJDK 17** (recomendado para React Native)
2. **Configurar JAVA_HOME** correctamente
3. **Reiniciar** terminal y compilar

## 📋 Pasos para Instalar Java 17:

### Opción A: Descarga Manual (Recomendado)
1. Ve a: https://adoptium.net/download/
2. Selecciona:
   - Operating System: **Windows**
   - Architecture: **x64**
   - Package Type: **JDK** 
   - Version: **17** (LTS)
3. Descarga e instala el archivo `.msi`
4. Reinicia tu terminal

### Opción B: Usando Chocolatey
```powershell
choco install openjdk17
```

### Opción C: Usando Winget  
```powershell
winget install Microsoft.OpenJDK.17
```

## 🔄 Después de la Instalación:

### 1. Verificar instalación:
```powershell
java -version
# Debe mostrar: openjdk version "17.x.x"
```

### 2. Verificar JAVA_HOME:
```powershell
echo $env:JAVA_HOME
# Debe apuntar a la carpeta de Java 17
```

### 3. Si JAVA_HOME no se actualizó automáticamente:
1. Abre **Variables de entorno** del sistema
2. Edita `JAVA_HOME` para que apunte a: 
   `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot`
3. Reinicia PowerShell

### 4. Compilar proyecto:
```powershell
cd "c:\Users\franc\Desktop\Pelis4K"
npx expo run:android
```

## ✅ Una vez configurado Java 17:
- ✅ El proyecto compilará correctamente
- ✅ Chromecast real funcionará
- ✅ Todas las dependencias nativas se resolverán

## 🎬 Resultado Final:
Tu app tendrá **Chromecast completamente funcional** conectándose a dispositivos reales en tu red Wi-Fi.
