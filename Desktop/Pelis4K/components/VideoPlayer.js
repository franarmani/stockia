import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Alert,
  Animated,
  Modal,
} from 'react-native';
import { Video } from 'expo-av';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
// import * as ScreenOrientation from 'expo-screen-orientation';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const VideoPlayer = ({ 
  visible, 
  onClose, 
  videoSource, 
  title, 
  subtitle 
}) => {
  // Detectar si es un iframe o URL directa de video
  const isIframe = videoSource && (
    videoSource.includes('filemoon') ||
    videoSource.includes('streamhd') ||
    videoSource.includes('doodstream') ||
    videoSource.includes('uqload') ||
    videoSource.includes('fembed') ||
    videoSource.includes('voe.sx') ||
    videoSource.includes('streamtape') ||
    videoSource.includes('mixdrop') ||
    videoSource.includes('upstream') ||
    !videoSource.includes('.mp4')
  );

  const [status, setStatus] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCasting, setIsCasting] = useState(false);
  const [castDevices, setCastDevices] = useState([]);
  const [showCastModal, setShowCastModal] = useState(false);

  const videoRef = useRef(null);
  const webViewRef = useRef(null);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const progressValue = useRef(new Animated.Value(0)).current;
  const hideControlsTimeout = useRef(null);

  // Auto-hide controls after 3 seconds (solo para video directo, no iframe)
  const resetControlsTimer = () => {
    if (isIframe) return; // No ocultar controles en iframe
    
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    
    setControlsVisible(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    hideControlsTimeout.current = setTimeout(() => {
      if (isPlaying) {
        setControlsVisible(false);
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    }, 3000);
  };

  // Toggle play/pause
  const togglePlayPause = async () => {
    try {
      if (videoRef.current) {
        if (isPlaying) {
          await videoRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          await videoRef.current.playAsync();
          setIsPlaying(true);
        }
        resetControlsTimer();
      }
    } catch (error) {
      console.log('Error toggling play/pause:', error);
    }
  };

  // Seek to position
  const seekTo = async (position) => {
    try {
      if (videoRef.current && duration > 0) {
        const seekPosition = (position / 100) * duration;
        await videoRef.current.setPositionAsync(seekPosition);
        setCurrentTime(seekPosition);
      }
    } catch (error) {
      console.log('Error seeking video:', error);
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    try {
      // Comentado temporalmente hasta instalar la dependencia
      // if (isFullscreen) {
      //   await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
      //   setIsFullscreen(false);
      // } else {
      //   await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      //   setIsFullscreen(true);
      // }
      setIsFullscreen(!isFullscreen);
      resetControlsTimer();
    } catch (error) {
      console.log('Orientation change not available');
    }
  };

  // Format time for display
  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle video status updates
  const onPlaybackStatusUpdate = (status) => {
    setStatus(status);
    if (status.isLoaded) {
      setIsLoading(false);
      setCurrentTime(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying || false);
      
      if (status.durationMillis > 0) {
        const progress = (status.positionMillis || 0) / status.durationMillis;
        Animated.timing(progressValue, {
          toValue: progress,
          duration: 100,
          useNativeDriver: false,
        }).start();
      }
    }
  };

  // Chromecast functions (simulación para demo)
  const startCasting = async () => {
    try {
      // Simular búsqueda de dispositivos Chromecast disponibles
      const mockDevices = [
        { id: '1', name: 'Sala de estar - Chromecast Ultra', type: 'chromecast' },
        { id: '2', name: 'Dormitorio - Google TV', type: 'googletv' },
        { id: '3', name: 'Cocina - Nest Hub Max', type: 'nesthub' },
        { id: '4', name: 'Estudio - Chromecast 4K', type: 'chromecast' },
      ];
      
      setCastDevices(mockDevices);
      setShowCastModal(true);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron encontrar dispositivos de transmisión');
    }
  };

  const connectToDevice = async (device) => {
    try {
      setIsCasting(true);
      setShowCastModal(false);
      
      // Simular proceso de conexión con feedback visual
      Alert.alert(
        '🎬 Transmitiendo',
        `✅ Conectado exitosamente a ${device.name}\n\n📺 El video ahora se está reproduciendo en tu ${device.type === 'chromecast' ? 'Chromecast' : device.type === 'googletv' ? 'Google TV' : 'Nest Hub'}.\n\n🎮 Usa los controles de tu teléfono para pausar, adelantar o cambiar el volumen.`,
        [
          {
            text: '🔴 Detener transmisión',
            onPress: stopCasting,
            style: 'destructive'
          },
          { text: '👍 Entendido', style: 'default' }
        ]
      );
    } catch (error) {
      Alert.alert('❌ Error de conexión', 'No se pudo conectar al dispositivo. Verifica que esté en la misma red WiFi.');
    }
  };

  const stopCasting = () => {
    setIsCasting(false);
    Alert.alert(
      '📱 Transmisión detenida', 
      '✅ El video ahora se reproduce localmente en tu teléfono.\n\n🔄 Puedes volver a transmitir cuando quieras tocando el ícono de cast.',
      [{ text: '👍 Perfecto', style: 'default' }]
    );
  };

  // Show/hide controls on tap
  const handleScreenTap = () => {
    if (controlsVisible) {
      setControlsVisible(false);
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      resetControlsTimer();
    }
  };

  // Close player
  const handleClose = async () => {
    if (videoRef.current) {
      await videoRef.current.pauseAsync();
    }
    // await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    setIsFullscreen(false);
    onClose();
  };

  useEffect(() => {
    if (visible) {
      resetControlsTimer();
    }
    
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, [visible, isPlaying]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={handleClose}
    >
      <StatusBar hidden={isFullscreen} />
      
      <View style={[styles.container, isFullscreen && styles.fullscreenContainer]}>
        {/* Video Component */}
        <TouchableOpacity 
          style={styles.videoContainer} 
          activeOpacity={1}
          onPress={handleScreenTap}
        >
          {isIframe ? (
            <WebView
              ref={webViewRef}
              style={styles.video}
              source={{ uri: videoSource }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              onLoadStart={() => setIsLoading(true)}
              onLoadEnd={() => setIsLoading(false)}
              onHttpError={() => {
                setIsLoading(false);
                Alert.alert('Error', 'No se pudo cargar el video. Intenta con otro enlace.');
              }}
            />
          ) : (
            <Video
              ref={videoRef}
              style={styles.video}
              source={{ uri: videoSource }}
              useNativeControls={false}
              resizeMode="contain"
              shouldPlay={false}
              isLooping={false}
              volume={volume}
              onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            />
          )}
          
          {/* Loading Indicator */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <LinearGradient
                colors={['rgba(157, 80, 187, 0.9)', 'rgba(123, 45, 158, 0.9)']}
                style={styles.loadingBackground}
              >
                <Ionicons name="play-circle" size={80} color="#fff" />
                <Text style={styles.loadingText}>Cargando video...</Text>
                <Text style={styles.loadingSubtext}>
                  {title ? `Preparando "${title}"` : 'Iniciando reproductor'}
                </Text>
              </LinearGradient>
            </View>
          )}
        </TouchableOpacity>

        {/* Controls Overlay */}
        <Animated.View 
          style={[styles.controlsOverlay, { opacity: controlsOpacity }]}
          pointerEvents={controlsVisible ? 'auto' : 'none'}
        >
          {/* Top Bar */}
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.8)', 'transparent']}
            style={styles.topBar}
          >
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.titleContainer}>
              <Text style={styles.videoTitle} numberOfLines={1}>{title}</Text>
              {subtitle && (
                <Text style={styles.videoSubtitle} numberOfLines={1}>{subtitle}</Text>
              )}
            </View>

            <TouchableOpacity 
              style={[styles.castButton, isCasting && styles.castButtonActive]} 
              onPress={isCasting ? stopCasting : startCasting}
            >
              <Ionicons 
                name={isCasting ? "radio" : "wifi"} 
                size={28} 
                color={isCasting ? "#9D50BB" : "#fff"} 
              />
            </TouchableOpacity>
          </LinearGradient>

          {/* Center Play Button */}
          {!isPlaying && !isLoading && (
            <TouchableOpacity style={styles.centerPlayButton} onPress={togglePlayPause}>
              <LinearGradient
                colors={['#9D50BB', '#7B2D9E']}
                style={styles.centerPlayBackground}
              >
                <Ionicons name="play" size={60} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Bottom Controls */}
          <LinearGradient
            colors={['transparent', 'rgba(0, 0, 0, 0.8)']}
            style={styles.bottomControls}
          >
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              
              <TouchableOpacity 
                style={styles.progressBarContainer}
                onPress={(event) => {
                  try {
                    const { locationX } = event.nativeEvent;
                    const progressBarWidth = styles.progressBar.flex * 200; // Estimación
                    const percentage = (locationX / progressBarWidth) * 100;
                    seekTo(Math.max(0, Math.min(100, percentage)));
                  } catch (error) {
                    console.log('Error seeking:', error);
                  }
                }}
                activeOpacity={0.8}
              >
                <View style={styles.progressBar}>
                  <View style={styles.progressTrack} />
                  <Animated.View 
                    style={[
                      styles.progressFill,
                      {
                        width: progressValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        })
                      }
                    ]} 
                  />
                  <Animated.View 
                    style={[
                      styles.progressThumb,
                      {
                        left: progressValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        })
                      }
                    ]} 
                  />
                </View>
              </TouchableOpacity>
              
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>

            {/* Control Buttons */}
            <View style={styles.controlButtons}>
              <TouchableOpacity style={styles.controlButton} onPress={togglePlayPause}>
                <Ionicons 
                  name={isPlaying ? "pause" : "play"} 
                  size={32} 
                  color="#fff" 
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlButton}>
                <Ionicons name="volume-high" size={28} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlButton}>
                <Ionicons name="settings" size={28} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlButton} onPress={toggleFullscreen}>
                <Ionicons 
                  name={isFullscreen ? "contract" : "expand"} 
                  size={28} 
                  color="#fff" 
                />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Cast Modal */}
        <Modal
          visible={showCastModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowCastModal(false)}
        >
          <View style={styles.castModalOverlay}>
            <LinearGradient
              colors={['#1f032b', '#2a0845']}
              style={styles.castModalContainer}
            >
              <View style={styles.castModalHeader}>
                <View style={styles.castHeaderContent}>
                  <Ionicons name="wifi" size={32} color="#9D50BB" />
                  <Text style={styles.castModalTitle}>Transmitir a dispositivo</Text>
                </View>
                <TouchableOpacity onPress={() => setShowCastModal(false)}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.castModalSubtitle}>
                Selecciona el dispositivo donde quieres ver "{title}"
              </Text>

              {castDevices.map((device) => (
                <TouchableOpacity
                  key={device.id}
                  style={styles.castDeviceItem}
                  onPress={() => connectToDevice(device)}
                >
                  <Ionicons 
                    name={device.type === 'chromecast' ? 'wifi' : 
                          device.type === 'googletv' ? 'tv' : 'home'} 
                    size={32} 
                    color="#9D50BB" 
                  />
                  <Text style={styles.castDeviceName}>{device.name}</Text>
                  <Ionicons name="chevron-forward" size={24} color="rgba(255, 255, 255, 0.5)" />
                </TouchableOpacity>
              ))}

              <TouchableOpacity 
                style={styles.castCancelButton}
                onPress={() => setShowCastModal(false)}
              >
                <Text style={styles.castCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  fullscreenContainer: {
    width: screenHeight,
    height: screenWidth,
  },
  
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  video: {
    width: '100%',
    height: '100%',
  },
  
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  loadingBackground: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
  },
  
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  
  loadingSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  
  closeButton: {
    padding: 8,
  },
  
  titleContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
  
  videoTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  
  videoSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  
  castButton: {
    padding: 8,
    borderRadius: 20,
  },
  
  castButtonActive: {
    backgroundColor: 'rgba(157, 80, 187, 0.3)',
  },
  
  centerPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -60 }, { translateY: -60 }],
  },
  
  centerPlayBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  
  bottomControls: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  
  timeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'center',
  },
  
  progressBarContainer: {
    flex: 1,
    marginHorizontal: 16,
    paddingVertical: 8,
  },
  
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    position: 'relative',
  },
  
  progressTrack: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  
  progressFill: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#9D50BB',
    borderRadius: 2,
  },
  
  progressThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    top: -6,
    marginLeft: -8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  controlButton: {
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  
  // Cast Modal Styles
  castModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  
  castModalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    minHeight: 300,
  },
  
  castModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 80, 187, 0.3)',
  },
  
  castHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  castModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
  },
  
  castModalSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  
  castDeviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginVertical: 6,
    backgroundColor: 'rgba(157, 80, 187, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.2)',
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  
  castDeviceName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 16,
  },
  
  castCancelButton: {
    marginTop: 20,
    padding: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  
  castCancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VideoPlayer;
