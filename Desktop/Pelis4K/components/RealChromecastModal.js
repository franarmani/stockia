import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import chromecastService from '../services/RealChromecastService';

const RealChromecastModal = ({ visible, onClose, item, videoUrl, onStartCasting }) => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [castingStatus, setCastingStatus] = useState('');
  const [mediaStatus, setMediaStatus] = useState(null);

  useEffect(() => {
    if (visible) {
      discoverDevices();
      
      // Agregar listeners del servicio
      const removeListener = chromecastService.addListener((event, data) => {
        handleChromecastEvent(event, data);
      });

      return () => {
        removeListener();
      };
    }
  }, [visible]);

  const handleChromecastEvent = (event, data) => {
    console.log('📡 Evento Chromecast:', event, data);
    
    switch (event) {
      case 'devicesDiscovered':
        setDevices(data);
        setIsDiscovering(false);
        break;
        
      case 'deviceConnected':
        setIsConnected(true);
        setIsConnecting(false);
        setSelectedDevice(data);
        setCastingStatus('Conectado');
        startCasting();
        break;
        
      case 'deviceDisconnected':
        setIsConnected(false);
        setSelectedDevice(null);
        setCastingStatus('');
        setMediaStatus(null);
        break;
        
      case 'mediaLoaded':
        setCastingStatus('Reproduciendo');
        if (onStartCasting) {
          onStartCasting({
            device: selectedDevice,
            content: item,
            videoUrl: videoUrl
          });
        }
        break;
        
      case 'connectionError':
      case 'castError':
        setIsConnecting(false);
        Alert.alert('Error', data.error);
        break;
        
      case 'playbackPaused':
        setCastingStatus('Pausado');
        break;
        
      case 'playbackResumed':
        setCastingStatus('Reproduciendo');
        break;
        
      case 'playbackStopped':
        setCastingStatus('Detenido');
        break;
    }
  };

  const discoverDevices = async () => {
    setIsDiscovering(true);
    try {
      const foundDevices = await chromecastService.discoverDevices();
      setDevices(foundDevices);
    } catch (error) {
      console.error('Error discovering devices:', error);
      Alert.alert('Error', 'No se pudieron encontrar dispositivos Chromecast');
    } finally {
      setIsDiscovering(false);
    }
  };

  const connectToDevice = async (device) => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    setSelectedDevice(device);
    
    try {
      const success = await chromecastService.connectToDevice(device.id);
      if (!success) {
        setIsConnecting(false);
        setSelectedDevice(null);
      }
    } catch (error) {
      setIsConnecting(false);
      setSelectedDevice(null);
      Alert.alert('Error', 'No se pudo conectar al dispositivo');
    }
  };

  const startCasting = async () => {
    if (!videoUrl || !item) {
      Alert.alert('Error', 'No hay contenido para transmitir');
      return;
    }

    try {
      const videoData = {
        url: videoUrl,
        title: item.title || item.name,
        subtitle: item.overview || '',
        poster: item.poster_path || item.image
      };

      await chromecastService.castVideo(videoData);
    } catch (error) {
      console.error('Error casting video:', error);
      Alert.alert('Error', 'No se pudo transmitir el video');
    }
  };

  const handlePlayPause = async () => {
    try {
      await chromecastService.playPause();
    } catch (error) {
      console.error('Error play/pause:', error);
    }
  };

  const handleStop = async () => {
    try {
      await chromecastService.stop();
      setCastingStatus('Detenido');
    } catch (error) {
      console.error('Error stopping:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await chromecastService.disconnect();
      setIsConnected(false);
      setSelectedDevice(null);
      setCastingStatus('');
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  const handleClose = () => {
    if (isConnected) {
      Alert.alert(
        'Transmisión activa',
        '¿Quieres mantener la transmisión o desconectar?',
        [
          { text: 'Mantener', onPress: onClose },
          { 
            text: 'Desconectar', 
            onPress: async () => {
              await handleDisconnect();
              onClose();
            }
          }
        ]
      );
    } else {
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <LinearGradient
            colors={['#9D50BB', '#6B2D8A']}
            style={styles.modalHeader}
          >
            <View style={styles.headerContent}>
              <Ionicons name="wifi" size={24} color="#fff" />
              <Text style={styles.modalTitle}>Transmitir a TV</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Contenido */}
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Información del contenido */}
            {item && (
              <View style={styles.contentInfo}>
                <View style={styles.contentHeader}>
                  {(item.poster_path || item.image) && (
                    <Image 
                      source={{ uri: item.poster_path || item.image }} 
                      style={styles.contentPoster}
                    />
                  )}
                  <View style={styles.contentDetails}>
                    <Text style={styles.contentTitle} numberOfLines={2}>
                      {item.title || item.name}
                    </Text>
                    {item.overview && (
                      <Text style={styles.contentDescription} numberOfLines={3}>
                        {item.overview}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Estado de conexión */}
            {isConnected && selectedDevice && (
              <View style={styles.connectionStatus}>
                <View style={styles.connectedDevice}>
                  <Ionicons name="tv" size={20} color="#9D50BB" />
                  <Text style={styles.connectedDeviceName}>{selectedDevice.name}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{castingStatus}</Text>
                  </View>
                </View>

                {/* Controles de reproducción */}
                <View style={styles.playbackControls}>
                  <TouchableOpacity 
                    style={styles.controlButton}
                    onPress={handlePlayPause}
                  >
                    <Ionicons name="play-pause" size={24} color="#fff" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.controlButton}
                    onPress={handleStop}
                  >
                    <Ionicons name="stop" size={24} color="#fff" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.controlButton, styles.disconnectButton]}
                    onPress={handleDisconnect}
                  >
                    <Ionicons name="power" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Lista de dispositivos */}
            {!isConnected && (
              <>
                <View style={styles.devicesHeader}>
                  <Text style={styles.devicesTitle}>Dispositivos disponibles</Text>
                  <TouchableOpacity 
                    style={styles.refreshButton}
                    onPress={discoverDevices}
                    disabled={isDiscovering}
                  >
                    <Ionicons 
                      name="refresh" 
                      size={20} 
                      color="#9D50BB" 
                      style={isDiscovering ? styles.spinning : null}
                    />
                  </TouchableOpacity>
                </View>

                {isDiscovering ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#9D50BB" />
                    <Text style={styles.loadingText}>Buscando dispositivos...</Text>
                  </View>
                ) : devices.length > 0 ? (
                  <View style={styles.devicesList}>
                    {devices.map((device) => (
                      <TouchableOpacity
                        key={device.id}
                        style={[
                          styles.deviceItem,
                          selectedDevice?.id === device.id && styles.deviceItemSelected
                        ]}
                        onPress={() => connectToDevice(device)}
                        disabled={isConnecting}
                      >
                        <View style={styles.deviceInfo}>
                          <Ionicons name="tv" size={24} color="#9D50BB" />
                          <View style={styles.deviceDetails}>
                            <Text style={styles.deviceName}>{device.name}</Text>
                            <Text style={styles.deviceType}>{device.type || 'Chromecast'}</Text>
                          </View>
                        </View>
                        
                        {isConnecting && selectedDevice?.id === device.id ? (
                          <ActivityIndicator size="small" color="#9D50BB" />
                        ) : (
                          <Ionicons name="chevron-forward" size={20} color="#666" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.noDevicesContainer}>
                    <Ionicons name="wifi-off" size={48} color="#666" />
                    <Text style={styles.noDevicesText}>No se encontraron dispositivos</Text>
                    <Text style={styles.noDevicesSubtext}>
                      Asegúrate de que tu Chromecast esté conectado a la misma red Wi-Fi
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  
  modalContent: {
    backgroundColor: '#1A0225',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '60%',
  },
  
  modalHeader: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    marginLeft: 12,
  },
  
  closeButton: {
    padding: 4,
  },
  
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  contentInfo: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 80, 187, 0.2)',
    marginBottom: 16,
  },
  
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  
  contentPoster: {
    width: 60,
    height: 90,
    borderRadius: 8,
    marginRight: 12,
  },
  
  contentDetails: {
    flex: 1,
  },
  
  contentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  
  contentDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
  
  connectionStatus: {
    backgroundColor: 'rgba(157, 80, 187, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.3)',
  },
  
  connectedDevice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  
  connectedDeviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
    flex: 1,
  },
  
  statusBadge: {
    backgroundColor: '#9D50BB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  
  playbackControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  
  controlButton: {
    backgroundColor: '#9D50BB',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  disconnectButton: {
    backgroundColor: '#E74C3C',
  },
  
  devicesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  
  devicesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  
  refreshButton: {
    padding: 8,
  },
  
  spinning: {
    transform: [{ rotate: '360deg' }],
  },
  
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  
  loadingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 12,
  },
  
  devicesList: {
    gap: 8,
  },
  
  deviceItem: {
    backgroundColor: 'rgba(26, 2, 37, 0.8)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.2)',
  },
  
  deviceItemSelected: {
    borderColor: '#9D50BB',
    backgroundColor: 'rgba(157, 80, 187, 0.1)',
  },
  
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  deviceDetails: {
    marginLeft: 12,
    flex: 1,
  },
  
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  
  deviceType: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  
  noDevicesContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  
  noDevicesText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  
  noDevicesSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});

export default RealChromecastModal;
