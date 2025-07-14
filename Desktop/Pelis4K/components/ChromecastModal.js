import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import chromecastService from '../services/ChromecastService';

const ChromecastModal = ({ 
  visible, 
  onClose, 
  item, 
  videoUrl, 
  onStartCasting 
}) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(null);
  const [connected, setConnected] = useState(false);
  const [currentDevice, setCurrentDevice] = useState(null);
  const [casting, setCasting] = useState(false);
  const [castProgress, setCastProgress] = useState(0);

  useEffect(() => {
    if (visible) {
      discoverDevices();
      
      // Listener para eventos de Chromecast
      const removeListener = chromecastService.addListener((event, data) => {
        switch (event) {
          case 'connected':
            setConnected(true);
            setCurrentDevice(data);
            setConnecting(null);
            break;
          case 'disconnected':
            setConnected(false);
            setCurrentDevice(null);
            setCasting(false);
            break;
          case 'casting':
            setCasting(true);
            onStartCasting && onStartCasting(data);
            break;
          case 'progress':
            setCastProgress(data.progress);
            break;
          case 'finished':
            setCasting(false);
            setCastProgress(0);
            Alert.alert('✅ Reproducción completada', 'El contenido ha terminado de reproducirse');
            break;
        }
      });

      return removeListener;
    }
  }, [visible]);

  const discoverDevices = async () => {
    try {
      setLoading(true);
      const foundDevices = await chromecastService.discoverDevices();
      setDevices(foundDevices);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron encontrar dispositivos');
    } finally {
      setLoading(false);
    }
  };

  const connectToDevice = async (device) => {
    try {
      setConnecting(device.id);
      await chromecastService.connectToDevice(device);
    } catch (error) {
      setConnecting(null);
      Alert.alert('Error de conexión', error.message);
    }
  };

  const startCasting = async () => {
    try {
      if (!videoUrl) {
        Alert.alert('Error', 'No hay URL de video disponible');
        return;
      }
      
      await chromecastService.castContent(item, videoUrl);
    } catch (error) {
      Alert.alert('Error de transmisión', error.message);
    }
  };

  const disconnect = async () => {
    await chromecastService.disconnect();
    onClose();
  };

  const renderDeviceList = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Dispositivos disponibles</Text>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9D50BB" />
          <Text style={styles.loadingText}>Buscando dispositivos...</Text>
        </View>
      ) : devices.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="wifi-outline" size={48} color="rgba(157, 80, 187, 0.5)" />
          <Text style={styles.emptyText}>No se encontraron dispositivos</Text>
          <TouchableOpacity style={styles.retryButton} onPress={discoverDevices}>
            <Text style={styles.retryButtonText}>Buscar de nuevo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.deviceList}>
          {devices.map((device) => (
            <TouchableOpacity
              key={device.id}
              style={styles.deviceItem}
              onPress={() => connectToDevice(device)}
              disabled={connecting === device.id}
            >
              <View style={styles.deviceIcon}>
                <Ionicons 
                  name={device.type.includes('Ultra') ? 'tv' : device.type.includes('Hub') ? 'radio' : 'wifi'} 
                  size={24} 
                  color="#9D50BB" 
                />
              </View>
              
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{device.name}</Text>
                <Text style={styles.deviceType}>{device.type}</Text>
              </View>
              
              {connecting === device.id ? (
                <ActivityIndicator size="small" color="#9D50BB" />
              ) : (
                <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderConnectedView = () => (
    <View style={styles.section}>
      <View style={styles.connectedHeader}>
        <Ionicons name="wifi" size={24} color="#4CAF50" />
        <Text style={styles.connectedTitle}>Conectado</Text>
      </View>
      
      <View style={styles.currentDevice}>
        <Text style={styles.currentDeviceName}>{currentDevice?.name}</Text>
        <Text style={styles.currentDeviceType}>{currentDevice?.type}</Text>
      </View>

      {!casting ? (
        <View style={styles.contentInfo}>
          <Text style={styles.contentTitle}>{item?.title || item?.name}</Text>
          <Text style={styles.contentDescription}>
            {item?.overview || 'Listo para transmitir'}
          </Text>
          
          <TouchableOpacity style={styles.castButton} onPress={startCasting}>
            <LinearGradient
              colors={['#9D50BB', '#7B2D9E']}
              style={styles.castButtonGradient}
            >
              <Ionicons name="play" size={24} color="#fff" />
              <Text style={styles.castButtonText}>Transmitir ahora</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.castingInfo}>
          <Text style={styles.castingTitle}>Transmitiendo...</Text>
          <Text style={styles.castingContent}>{item?.title || item?.name}</Text>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${castProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(castProgress)}%</Text>
          </View>
          
          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton} onPress={() => chromecastService.pause()}>
              <Ionicons name="pause" size={20} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton} onPress={() => chromecastService.play()}>
              <Ionicons name="play" size={20} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton} onPress={() => chromecastService.stop()}>
              <Ionicons name="stop" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      <TouchableOpacity style={styles.disconnectButton} onPress={disconnect}>
        <Text style={styles.disconnectButtonText}>Desconectar</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={['#1A0225', '#2D1B35']}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          
          <Text style={styles.title}>Transmitir a TV</Text>
          
          <TouchableOpacity style={styles.refreshButton} onPress={discoverDevices}>
            <Ionicons name="refresh" size={24} color="#9D50BB" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {connected ? renderConnectedView() : renderDeviceList()}
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 80, 187, 0.3)',
  },
  
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(157, 80, 187, 0.2)',
  },
  
  content: {
    flex: 1,
    padding: 20,
  },
  
  section: {
    marginBottom: 30,
  },
  
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  
  loadingText: {
    color: '#9D50BB',
    marginTop: 10,
    fontSize: 14,
  },
  
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  
  emptyText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 10,
    marginBottom: 20,
  },
  
  retryButton: {
    backgroundColor: 'rgba(157, 80, 187, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.5)',
  },
  
  retryButtonText: {
    color: '#9D50BB',
    fontWeight: 'bold',
  },
  
  deviceList: {
    maxHeight: 300,
  },
  
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(157, 80, 187, 0.1)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.3)',
  },
  
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(157, 80, 187, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  
  deviceInfo: {
    flex: 1,
  },
  
  deviceName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  deviceType: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  
  connectedTitle: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  
  currentDevice: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  
  currentDeviceName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  currentDeviceType: {
    color: '#4CAF50',
    fontSize: 12,
    marginTop: 2,
  },
  
  contentInfo: {
    marginBottom: 20,
  },
  
  contentTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  
  contentDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  
  castButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  
  castButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
  },
  
  castButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  
  castingInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  
  castingTitle: {
    color: '#9D50BB',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  
  castingContent: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 20,
  },
  
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    marginRight: 10,
  },
  
  progressFill: {
    height: '100%',
    backgroundColor: '#9D50BB',
    borderRadius: 2,
  },
  
  progressText: {
    color: '#9D50BB',
    fontSize: 12,
    fontWeight: 'bold',
    minWidth: 35,
  },
  
  controls: {
    flexDirection: 'row',
    gap: 15,
  },
  
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(157, 80, 187, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  disconnectButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  
  disconnectButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ChromecastModal;
