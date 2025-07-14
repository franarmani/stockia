# Troubleshooting Google Cast SDK

## Problema Actual
El SDK de Google Cast se carga correctamente pero las funciones no están disponibles:
```
LOG  ✅ Google Cast SDK cargado correctamente
WARN  ⚠️ Error en Google Cast real, cambiando a modo simulado: Funciones de Google Cast no disponibles
```

## Posibles Causas y Soluciones

### 1. Autolinking Incompleto
**Síntomas**: El módulo se importa pero las funciones no existen
**Solución**:
```bash
cd c:\Users\franc\Desktop\Pelis4K
npx react-native unlink react-native-google-cast
npx react-native link react-native-google-cast
```

### 2. Configuración de AndroidManifest.xml
**Verificar que existe**:
```xml
<!-- En android/app/src/main/AndroidManifest.xml -->
<meta-data 
  android:name="com.google.android.gms.cast.framework.OPTIONS_PROVIDER_CLASS_NAME"
  android:value="com.reactnative.googlecast.GoogleCastOptionsProvider" />
```

### 3. Configuración de build.gradle
**Verificar que existe**:
```gradle
// En android/app/build.gradle
implementation 'com.google.android.gms:play-services-cast-framework:21.3.0'
implementation 'androidx.mediarouter:mediarouter:1.4.0'
implementation 'androidx.appcompat:appcompat:1.5.1'
```

### 4. GoogleCastOptionsProvider
**Verificar que existe**: `android/app/src/main/java/com/reactnative/googlecast/GoogleCastOptionsProvider.java`

### 5. Limpiar Cache y Rebuild
```bash
cd c:\Users\franc\Desktop\Pelis4K
# Limpiar caché de npm
npm start -- --reset-cache

# Limpiar build de Android  
cd android
./gradlew clean

# Reconstruir
cd ..
npx expo run:android --no-build-cache
```

### 6. Verificar Versiones
- react-native-google-cast: ^4.8.3 ✅
- React Native: 0.79.5 ✅
- Expo: ~53.0.17 ✅

## Estado de Funciones Esperadas
El servicio verifica estas funciones:
- `startDiscovery` - Iniciar búsqueda de dispositivos
- `stopDiscovery` - Detener búsqueda  
- `getAvailableDevices` - Obtener dispositivos disponibles
- `connectToDevice` - Conectar a dispositivo
- `disconnect` - Desconectar
- `getCastState` - Obtener estado actual
- `EventEmitter` - Sistema de eventos

## Modo Simulado
Mientras se resuelve el problema, el sistema funciona en modo simulado con:
- 4 dispositivos Chromecast simulados
- Interfaz idéntica a la real
- Funcionalidad completa de casting simulado

## Próximos Pasos
1. ✅ Verificar logging detallado del SDK
2. 🔄 Rebuild completo del proyecto Android
3. 🔍 Verificar autolinking automático
4. 🛠️ Link manual si es necesario
