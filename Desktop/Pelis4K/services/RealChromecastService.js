// Servicio de Chromecast con manejo robusto de errores
class ChromecastService {
  constructor() {
    this.listeners = new Set();
    this.isInitialized = false;
    this.currentSession = null;
    this.connectedDevice = null;
    this.isSimulatedMode = true; // Iniciar siempre en modo simulado
    this.googleCastAvailable = false;
    
    // Dispositivos simulados para la funcionalidad
    this.simulatedDevices = [
      {
        id: 'chromecast-sala',
        name: 'Sala de estar',
        type: 'Chromecast Ultra',
        isAvailable: true,
        signal: 'excellent'
      },
      {
        id: 'chromecast-dormitorio', 
        name: 'Dormitorio Principal',
        type: 'Chromecast',
        isAvailable: true,
        signal: 'good'
      },
      {
        id: 'smart-tv-cocina',
        name: 'Samsung TV Cocina',
        type: 'Smart TV',
        isAvailable: true,
        signal: 'fair'
      },
      {
        id: 'chromecast-estudio',
        name: 'Estudio/Oficina',
        type: 'Chromecast with Google TV',
        isAvailable: true,
        signal: 'excellent'
      }
    ];
    
    this.initializeService();
  }

  async initializeService() {
    try {
      console.log('🚀 Inicializando ChromecastService...');
      
      // Siempre intentar cargar el SDK, pero no fallar si no funciona
      const googleCastModule = await this.tryLoadGoogleCast();
      
      if (googleCastModule) {
        console.log('📡 Intentando inicializar Google Cast real...');
        await this.initializeRealGoogleCast(googleCastModule);
        
        // Verificar si realmente funciona haciendo una prueba
        const testPassed = await this.testGoogleCastFunctionality(googleCastModule);
        
        if (testPassed) {
          console.log('✅ Google Cast real completamente funcional');
          this.googleCastAvailable = true;
          this.isSimulatedMode = false;
        } else {
          console.log('⚠️ Google Cast parcialmente funcional, usando modo simulado');
          this.initializeSimulatedMode();
        }
      } else {
        console.log('🎭 Google Cast SDK no disponible, usando modo simulado');
        this.initializeSimulatedMode();
      }
      
      this.isInitialized = true;
      console.log(`🎯 ChromecastService listo - Modo: ${this.isSimulatedMode ? 'Simulado' : 'Real'}`);
    } catch (error) {
      console.warn('⚠️ Error en inicialización, fallback a modo simulado:', error.message);
      this.initializeSimulatedMode();
      this.isInitialized = true;
    }
  }

  async testGoogleCastFunctionality(GoogleCast) {
    try {
      console.log('🧪 Probando funcionalidad de Google Cast...');
      
      // Probar función básica sin efectos secundarios
      if (typeof GoogleCast.getCastState === 'function') {
        const state = await GoogleCast.getCastState();
        console.log('✅ getCastState funcional, estado:', state);
        return true;
      }
      
      // Si getCastState no existe, probar startDiscovery brevemente
      if (typeof GoogleCast.startDiscovery === 'function') {
        await GoogleCast.startDiscovery();
        console.log('✅ startDiscovery funcional');
        
        // Detener inmediatamente para no interferir
        if (typeof GoogleCast.stopDiscovery === 'function') {
          await GoogleCast.stopDiscovery();
        }
        return true;
      }
      
      console.log('❌ Funciones críticas no disponibles');
      return false;
    } catch (error) {
      console.log('❌ Error en prueba de funcionalidad:', error.message);
      return false;
    }
  }

  async tryLoadGoogleCast() {
    try {
      console.log('🔍 Intentando cargar react-native-google-cast...');
      
      // Verificar si el módulo existe en node_modules
      const GoogleCast = require('react-native-google-cast');
      console.log('📦 Módulo react-native-google-cast encontrado');
      
      if (GoogleCast && GoogleCast.default) {
        const castModule = GoogleCast.default;
        console.log('🔧 Verificando disponibilidad de funciones...');
        
        // Lista de funciones que esperamos del SDK
        const expectedFunctions = [
          'startDiscovery',
          'stopDiscovery', 
          'getAvailableDevices',
          'connectToDevice',
          'disconnect',
          'getCastState'
        ];
        
        const availableFunctions = [];
        const missingFunctions = [];
        
        expectedFunctions.forEach(func => {
          if (typeof castModule[func] === 'function') {
            availableFunctions.push(func);
          } else {
            missingFunctions.push(func);
          }
        });
        
        console.log(`✅ Funciones disponibles (${availableFunctions.length}/${expectedFunctions.length}):`, availableFunctions);
        
        if (missingFunctions.length > 0) {
          console.log(`❌ Funciones faltantes (${missingFunctions.length}):`, missingFunctions);
        }
        
        // Verificar EventEmitter
        const hasEventEmitter = castModule.EventEmitter !== undefined;
        console.log(`📡 EventEmitter disponible: ${hasEventEmitter ? '✅' : '❌'}`);
        
        // Si tenemos al menos las funciones básicas (2 o más), intentar usar el SDK
        if (availableFunctions.length >= 2) {
          console.log('🚀 SDK de Google Cast considerado funcional');
          return castModule;
        } else {
          console.warn('⚠️ SDK de Google Cast no completamente funcional, usando modo simulado');
          return null;
        }
      } else {
        console.warn('⚠️ Estructura del módulo Google Cast inesperada');
        console.log('🔍 Estructura encontrada:', Object.keys(GoogleCast));
        return null;
      }
    } catch (error) {
      console.warn('❌ Error cargando react-native-google-cast:', error.message);
      console.log('💡 Esto es normal si el autolinking no está completo');
      return null;
    }
  }

  async initializeRealGoogleCast(GoogleCast) {
    try {
      console.log('� Configurando Google Cast real...');
      
      // Verificar disponibilidad de funciones una por una
      const functionChecks = {
        'startDiscovery': typeof GoogleCast.startDiscovery === 'function',
        'stopDiscovery': typeof GoogleCast.stopDiscovery === 'function',
        'getAvailableDevices': typeof GoogleCast.getAvailableDevices === 'function',
        'connectToDevice': typeof GoogleCast.connectToDevice === 'function',
        'disconnect': typeof GoogleCast.disconnect === 'function',
        'getCastState': typeof GoogleCast.getCastState === 'function',
        'EventEmitter': GoogleCast.EventEmitter !== undefined
      };
      
      const availableFunctions = Object.keys(functionChecks).filter(key => functionChecks[key]);
      const missingFunctions = Object.keys(functionChecks).filter(key => !functionChecks[key]);
      
      console.log(`✅ Funciones disponibles (${availableFunctions.length}/7):`, availableFunctions);
      if (missingFunctions.length > 0) {
        console.log(`❌ Funciones faltantes (${missingFunctions.length}/7):`, missingFunctions);
      }
      
      // Configurar solo las funciones que están disponibles
      if (functionChecks.EventEmitter && GoogleCast.EventEmitter.addListener) {
        try {
          GoogleCast.EventEmitter.addListener('CAST_STATE_CHANGED', (castState) => {
            console.log('📡 Estado Cast cambiado:', castState);
            this.notifyListeners('castStateChanged', { castState });
          });

          GoogleCast.EventEmitter.addListener('SESSION_STARTED', (session) => {
            console.log('🎯 Sesión iniciada:', session);
            this.currentSession = session;
            this.connectedDevice = session.device;
            this.notifyListeners('deviceConnected', session.device);
          });

          GoogleCast.EventEmitter.addListener('SESSION_ENDED', () => {
            console.log('🔚 Sesión terminada');
            this.currentSession = null;
            this.connectedDevice = null;
            this.notifyListeners('deviceDisconnected');
          });
          
          console.log('✅ Listeners de Google Cast configurados');
        } catch (listenerError) {
          console.warn('⚠️ Error configurando listeners:', listenerError.message);
        }
      }
      
      // Solo marcar como exitoso si tenemos funciones básicas
      const hasBasicFunctions = functionChecks.getAvailableDevices || functionChecks.startDiscovery;
      
      if (hasBasicFunctions) {
        console.log('✅ Google Cast configurado con funcionalidad básica');
      } else {
        throw new Error('No hay funciones básicas disponibles');
      }
      
    } catch (error) {
      console.warn('⚠️ Error configurando Google Cast real:', error.message);
      throw error; // Re-lanzar para que initializeService maneje el fallback
    }
  }

  initializeSimulatedMode() {
    console.log('🎭 ChromecastService iniciado en modo simulado');
    console.log('💡 Razón: Google Cast SDK no completamente disponible');
    console.log(`📱 Dispositivos simulados disponibles: ${this.simulatedDevices.length}`);
    this.simulatedDevices.forEach((device, index) => {
      console.log(`   ${index + 1}. 📺 ${device.name} (${device.type}) - Señal: ${device.signal}`);
    });
    console.log('🔧 Para usar Google Cast real, asegúrate de que react-native-google-cast esté correctamente configurado');
  }

  async discoverDevices() {
    try {
      if (!this.isInitialized) {
        console.log('🔄 Inicializando servicio Chromecast...');
        await this.initializeService();
      }
      
      console.log(`📡 Modo de operación: ${this.isSimulatedMode ? 'Simulado' : 'Real Google Cast'}`);
      
      if (this.googleCastAvailable && !this.isSimulatedMode) {
        // Intentar usar Google Cast real
        try {
          const GoogleCast = require('react-native-google-cast').default;
          console.log('🔍 Buscando dispositivos Chromecast reales...');
          
          // Verificar que la función existe antes de llamarla
          if (typeof GoogleCast.getAvailableDevices === 'function') {
            const devices = await GoogleCast.getAvailableDevices();
            console.log(`✅ Dispositivos Chromecast reales encontrados: ${devices.length}`);
            
            if (devices.length > 0) {
              this.notifyListeners('devicesDiscovered', devices);
              return devices;
            } else {
              console.log('📱 No hay dispositivos reales, usando simulados como fallback');
              // Si no hay dispositivos reales, usar simulados
              this.notifyListeners('devicesDiscovered', this.simulatedDevices);
              return this.simulatedDevices;
            }
          } else {
            throw new Error('getAvailableDevices no está disponible');
          }
        } catch (realError) {
          console.warn('⚠️ Error en búsqueda real, usando dispositivos simulados:', realError.message);
          // Fallback a modo simulado en caso de error
          this.notifyListeners('devicesDiscovered', this.simulatedDevices);
          return this.simulatedDevices;
        }
      } else {
        // Modo simulado
        console.log('🎭 Buscando dispositivos Chromecast simulados...');
        
        // Simular delay de búsqueda realista
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        console.log(`✅ Encontrados ${this.simulatedDevices.length} dispositivos simulados:`);
        this.simulatedDevices.forEach(device => {
          console.log(`   📺 ${device.name} (${device.type}) - Señal: ${device.signal}`);
        });
        
        this.notifyListeners('devicesDiscovered', this.simulatedDevices);
        return this.simulatedDevices;
      }
    } catch (error) {
      console.warn('⚠️ Error general en descubrimiento, usando dispositivos simulados:', error.message);
      
      // Fallback siempre disponible
      this.notifyListeners('devicesDiscovered', this.simulatedDevices);
      return this.simulatedDevices;
    }
  }

  async connectToDevice(deviceId) {
    try {
      console.log('🔄 Conectando a dispositivo:', deviceId);
      
      if (this.googleCastAvailable && !this.isSimulatedMode) {
        // Modo real
        const GoogleCast = require('react-native-google-cast').default;
        await GoogleCast.connectToDevice(deviceId);
        return true;
      } else {
        // Modo simulado
        const device = this.simulatedDevices.find(d => d.id === deviceId);
        if (!device) {
          throw new Error('Dispositivo no encontrado');
        }
        
        // Simular proceso de conexión
        this.notifyListeners('connecting', device);
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        this.connectedDevice = device;
        this.currentSession = { device, id: deviceId };
        
        console.log('✅ Conectado a dispositivo simulado:', device.name);
        this.notifyListeners('deviceConnected', device);
        return true;
      }
    } catch (error) {
      console.error('❌ Error conectando al dispositivo:', error);
      this.notifyListeners('connectionError', { error: error.message });
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.googleCastAvailable && !this.isSimulatedMode && this.currentSession) {
        const GoogleCast = require('react-native-google-cast').default;
        await GoogleCast.endSession();
      } else {
        // Modo simulado
        const wasConnected = this.connectedDevice;
        this.currentSession = null;
        this.connectedDevice = null;
        
        if (wasConnected) {
          console.log('🔌 Desconectado de dispositivo simulado:', wasConnected.name);
          this.notifyListeners('deviceDisconnected', wasConnected);
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error desconectando:', error);
      return false;
    }
  }

  async castVideo(videoData) {
    try {
      if (!this.currentSession) {
        throw new Error('No hay sesión de Cast activa');
      }

      if (this.googleCastAvailable && !this.isSimulatedMode) {
        // Modo real
        const GoogleCast = require('react-native-google-cast').default;
        const mediaInfo = {
          contentUrl: videoData.url,
          contentType: 'video/mp4',
          metadata: {
            type: 'movie',
            title: videoData.title,
            subtitle: videoData.subtitle || '',
            images: videoData.poster ? [{ url: videoData.poster }] : []
          }
        };

        await GoogleCast.loadRemoteMedia(mediaInfo, true);
      } else {
        // Modo simulado
        console.log('🎬 Simulando transmisión de video:', videoData.title);
        this.notifyListeners('castingStarted', videoData);
        
        // Simular carga de video
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
      
      this.notifyListeners('mediaLoaded', videoData);
      console.log('✅ Video enviado a dispositivo:', videoData.title);
      return true;
    } catch (error) {
      console.error('❌ Error enviando video:', error);
      this.notifyListeners('castError', { error: error.message });
      return false;
    }
  }

  async playPause() {
    try {
      if (!this.currentSession) return false;
      
      if (this.googleCastAvailable && !this.isSimulatedMode) {
        const GoogleCast = require('react-native-google-cast').default;
        const mediaStatus = await GoogleCast.getMediaStatus();
        
        if (mediaStatus && mediaStatus.playerState === 'playing') {
          await GoogleCast.pause();
          this.notifyListeners('playbackPaused');
        } else {
          await GoogleCast.play();
          this.notifyListeners('playbackResumed');
        }
      } else {
        // Modo simulado
        this.notifyListeners('playbackToggled');
        console.log('⏯️ Control de reproducción simulado');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error controlando reproducción:', error);
      return false;
    }
  }

  async stop() {
    try {
      if (!this.currentSession) return false;
      
      if (this.googleCastAvailable && !this.isSimulatedMode) {
        const GoogleCast = require('react-native-google-cast').default;
        await GoogleCast.stop();
      } else {
        // Modo simulado
        console.log('⏹️ Deteniendo reproducción simulada');
      }
      
      this.notifyListeners('playbackStopped');
      return true;
    } catch (error) {
      console.error('❌ Error deteniendo reproducción:', error);
      return false;
    }
  }

  // Métodos de gestión de listeners
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  removeListener(callback) {
    this.listeners.delete(callback);
  }

  notifyListeners(event, data = {}) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error en listener de ChromecastService:', error);
      }
    });
  }

  // Getters para estado actual
  isConnected() {
    return this.currentSession !== null;
  }

  getConnectedDevice() {
    return this.connectedDevice;
  }

  isInSimulatedMode() {
    return this.isSimulatedMode;
  }

  getAvailableDevices() {
    return this.simulatedDevices;
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected(),
      device: this.connectedDevice,
      isSimulated: this.isSimulatedMode,
      googleCastAvailable: this.googleCastAvailable
    };
  }
}

// Instancia singleton
const chromecastService = new ChromecastService();
export default chromecastService;
