import { Alert } from 'react-native';

class ChromecastService {
  constructor() {
    this.isConnected = false;
    this.currentDevice = null;
    this.devices = [
      { id: '1', name: 'Sala de estar TV', type: 'Chromecast Ultra' },
      { id: '2', name: 'Dormitorio TV', type: 'Chromecast' },
      { id: '3', name: 'Cocina Display', type: 'Nest Hub' },
      { id: '4', name: 'TV Samsung', type: 'Smart TV' }
    ];
    this.listeners = [];
  }

  // Simular búsqueda de dispositivos
  async discoverDevices() {
    console.log('🔍 Buscando dispositivos Chromecast...');
    
    // Simular delay de búsqueda
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simular encontrar dispositivos aleatoriamente
    const availableDevices = this.devices.filter(() => Math.random() > 0.3);
    
    console.log(`📱 Encontrados ${availableDevices.length} dispositivos:`, availableDevices);
    return availableDevices;
  }

  // Conectar a un dispositivo
  async connectToDevice(device) {
    try {
      console.log(`🔗 Conectando a ${device.name}...`);
      
      // Simular proceso de conexión
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simular fallo ocasional de conexión
      if (Math.random() < 0.1) {
        throw new Error('No se pudo conectar al dispositivo');
      }
      
      this.isConnected = true;
      this.currentDevice = device;
      
      console.log(`✅ Conectado a ${device.name}`);
      this.notifyListeners('connected', device);
      
      return true;
    } catch (error) {
      console.error('❌ Error conectando:', error);
      throw error;
    }
  }

  // Desconectar dispositivo
  async disconnect() {
    if (this.currentDevice) {
      console.log(`🔌 Desconectando de ${this.currentDevice.name}...`);
      
      const deviceName = this.currentDevice.name;
      this.isConnected = false;
      this.currentDevice = null;
      
      this.notifyListeners('disconnected');
      console.log(`✅ Desconectado de ${deviceName}`);
    }
  }

  // Transmitir contenido
  async castContent(item, videoUrl) {
    if (!this.isConnected || !this.currentDevice) {
      throw new Error('No hay dispositivo conectado');
    }

    try {
      console.log(`📺 Transmitiendo "${item.title || item.name}" a ${this.currentDevice.name}`);
      console.log(`🔗 URL: ${videoUrl}`);
      
      // Simular inicio de transmisión
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const castData = {
        title: item.title || item.name,
        description: item.overview || 'Reproduciendo desde Pelis4K',
        videoUrl: videoUrl,
        posterUrl: item.poster_path || item.image,
        device: this.currentDevice,
        startTime: Date.now()
      };

      this.notifyListeners('casting', castData);
      
      // Simular control de reproducción
      this.simulatePlayback(castData);
      
      return castData;
    } catch (error) {
      console.error('❌ Error transmitiendo:', error);
      throw error;
    }
  }

  // Simular reproducción en curso
  simulatePlayback(castData) {
    let progress = 0;
    const duration = 7200; // 2 horas simuladas
    
    const updateProgress = () => {
      if (!this.isConnected) return;
      
      progress += 30; // 30 segundos cada update
      const progressPercent = (progress / duration) * 100;
      
      this.notifyListeners('progress', {
        ...castData,
        currentTime: progress,
        duration: duration,
        progress: progressPercent
      });
      
      if (progress < duration) {
        setTimeout(updateProgress, 2000); // Update cada 2 segundos
      } else {
        this.notifyListeners('finished', castData);
      }
    };
    
    setTimeout(updateProgress, 2000);
  }

  // Controles de reproducción
  async play() {
    if (this.isConnected) {
      console.log('▶️ Reproducir en Chromecast');
      this.notifyListeners('play');
    }
  }

  async pause() {
    if (this.isConnected) {
      console.log('⏸️ Pausar en Chromecast');
      this.notifyListeners('pause');
    }
  }

  async stop() {
    if (this.isConnected) {
      console.log('⏹️ Detener en Chromecast');
      this.notifyListeners('stop');
    }
  }

  async seek(time) {
    if (this.isConnected) {
      console.log(`⏭️ Buscar posición ${time}s en Chromecast`);
      this.notifyListeners('seek', { time });
    }
  }

  // Sistema de eventos
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error en listener de Chromecast:', error);
      }
    });
  }

  // Getters
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      device: this.currentDevice
    };
  }

  isDeviceConnected() {
    return this.isConnected;
  }

  getCurrentDevice() {
    return this.currentDevice;
  }
}

// Singleton instance
const chromecastService = new ChromecastService();

export default chromecastService;
