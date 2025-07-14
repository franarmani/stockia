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
  ActivityIndicator,
} from 'react-native';
import { Video } from 'expo-av';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PopupBlockerOverlay from './PopupBlockerOverlay';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const EmbedVideoPlayer = ({ 
  visible, 
  onClose, 
  videoSource, 
  title, 
  subtitle 
}) => {
  const [playerType, setPlayerType] = useState('loading'); // 'webview', 'native', 'iframe', 'loading'
  const [processedUrl, setProcessedUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [videoStatus, setVideoStatus] = useState({});
  const [blockedPopups, setBlockedPopups] = useState(0);
  const [showUltraSecure, setShowUltraSecure] = useState(false);

  const videoRef = useRef(null);
  const webViewRef = useRef(null);
  const controlsOpacity = useRef(new Animated.Value(1)).current;

  // Detectar tipo de enlace y procesar URL
  const detectAndProcessUrl = async (url) => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔍 Detectando tipo de enlace:', url);

      if (!url) {
        throw new Error('No hay URL para procesar');
      }

      // URLs directas de video (MP4, M3U8, etc.)
      if (url.match(/\.(mp4|m3u8|webm|avi|mov|mkv)(\?.*)?$/i)) {
        console.log('✅ Detectado: Video directo');
        setPlayerType('native');
        setProcessedUrl(url);
        return;
      }

      // Filemoon - Servidor principal de pelis4k.online
      if (url.includes('filemoon.sx') || url.includes('filemoon.to')) {
        console.log('✅ Detectado: Filemoon (servidor de pelis4k.online)');
        setPlayerType('webview');
        setProcessedUrl(url);
        return;
      }

      // Otros servidores de streaming comunes
      const streamingServers = [
        'streamhd.cc',
        'doodstream.com',
        'uqload.com',
        'fembed.com',
        'voe.sx',
        'streamtape.com',
        'mixdrop.co',
        'upstream.to',
        'streamlare.com',
        'vidoza.net',
        'gounlimited.to',
        'jetload.net'
      ];

      const isStreamingServer = streamingServers.some(server => url.includes(server));
      
      if (isStreamingServer) {
        console.log('✅ Detectado: Servidor de streaming');
        setPlayerType('webview');
        setProcessedUrl(url);
        return;
      }

      // YouTube embeds
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        console.log('✅ Detectado: YouTube');
        const embedUrl = convertToYouTubeEmbed(url);
        setPlayerType('webview');
        setProcessedUrl(embedUrl);
        return;
      }

      // Vimeo embeds
      if (url.includes('vimeo.com')) {
        console.log('✅ Detectado: Vimeo');
        const embedUrl = convertToVimeoEmbed(url);
        setPlayerType('webview');
        setProcessedUrl(embedUrl);
        return;
      }

      // Cualquier otro iframe o embed
      if (url.includes('iframe') || url.includes('embed')) {
        console.log('✅ Detectado: Iframe genérico');
        setPlayerType('webview');
        setProcessedUrl(url);
        return;
      }

      // Por defecto, intentar con WebView
      console.log('⚠️ Tipo desconocido, intentando con WebView');
      setPlayerType('webview');
      setProcessedUrl(url);

    } catch (error) {
      console.error('❌ Error procesando URL:', error);
      setError(error.message);
      setPlayerType('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Convertir URL de YouTube a embed
  const convertToYouTubeEmbed = (url) => {
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1`;
    }
    return url;
  };

  // Convertir URL de Vimeo a embed
  const convertToVimeoEmbed = (url) => {
    const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
    if (videoId) {
      return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
    }
    return url;
  };

  // Extraer ID de video de YouTube
  const extractYouTubeVideoId = (url) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // Efecto para procesar URL cuando cambia
  useEffect(() => {
    if (visible && videoSource) {
      detectAndProcessUrl(videoSource);
    }
  }, [visible, videoSource]);

  // Auto-ocultar controles
  const resetControlsTimer = () => {
    if (playerType === 'webview') return; // No ocultar controles en WebView
    
    setControlsVisible(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      setControlsVisible(false);
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 3000);
  };

  // Manejar tap en pantalla
  const handleScreenTap = () => {
    if (playerType === 'native') {
      resetControlsTimer();
    }
  };

  // Cerrar reproductor
  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pauseAsync();
    }
    onClose();
  };

  // Renderizar reproductor nativo para videos directos
  const renderNativePlayer = () => (
    <TouchableOpacity 
      style={styles.videoContainer} 
      activeOpacity={1}
      onPress={handleScreenTap}
    >
      <Video
        ref={videoRef}
        style={styles.video}
        source={{ uri: processedUrl }}
        useNativeControls={false}
        resizeMode="contain"
        shouldPlay={true}
        isLooping={false}
        onPlaybackStatusUpdate={setVideoStatus}
        onLoadStart={() => setIsLoading(true)}
        onLoad={() => setIsLoading(false)}
        onError={(error) => {
          console.error('Error en video nativo:', error);
          setError('Error cargando el video');
          setIsLoading(false);
        }}
      />

      {/* Controles nativos personalizados */}
      <Animated.View 
        style={[styles.controlsOverlay, { opacity: controlsOpacity }]}
        pointerEvents={controlsVisible ? 'auto' : 'none'}
      >
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.7)', 'transparent']}
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
        </LinearGradient>

        {/* Botón de play central */}
        {!videoStatus.isPlaying && !isLoading && (
          <TouchableOpacity 
            style={styles.centerPlayButton} 
            onPress={() => videoRef.current?.playAsync()}
          >
            <LinearGradient
              colors={['#9D50BB', '#7B2D9E']}
              style={styles.centerPlayBackground}
            >
              <Ionicons name="play" size={60} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </Animated.View>
    </TouchableOpacity>
  );

  // Renderizar WebView para embeds
  const renderWebViewPlayer = () => {
    // JavaScript personalizado para bloquear popups sin sandbox
    const injectedJavaScript = `
      (function() {
        console.log('🛡️ Iniciando bloqueo anti-popup');
        
        let popupBlockCount = 0;
        
        // Función para reportar bloqueos
        function reportPopupBlock(method, details) {
          popupBlockCount++;
          console.log('🚫 Popup bloqueado [' + popupBlockCount + '] ' + method + ':', details);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'blocked',
              count: popupBlockCount,
              method: method,
              details: details
            }));
          }
        }
        
        // Método 1: Bloquear window.open sin ser detectado
        const originalOpen = window.open;
        window.open = function(url, name, specs) {
          reportPopupBlock('window.open', url);
          return null;
        };
        
        // Método 2: Bloquear creación de nuevas ventanas
        Object.defineProperty(window, 'open', {
          value: function() {
            reportPopupBlock('defineProperty', arguments[0]);
            return null;
          },
          writable: false,
          configurable: false
        });
        
        // Método 3: Interceptar eventos de click en enlaces
        document.addEventListener('click', function(e) {
          if (e.target.tagName === 'A' || e.target.closest('a')) {
            const link = e.target.tagName === 'A' ? e.target : e.target.closest('a');
            if (link.target === '_blank' || link.href.includes('popup') || link.href.includes('ad')) {
              reportPopupBlock('click-link', link.href);
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }
        }, true);
        
        // Método 4: Bloquear focus en nuevas ventanas
        window.focus = function() {
          console.log('🚫 Focus bloqueado');
          return false;
        };
        
        // Método 5: Interceptar createElement para ads
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
          const element = originalCreateElement.call(document, tagName);
          if (tagName.toLowerCase() === 'iframe' || tagName.toLowerCase() === 'frame') {
            // Bloquear iframes de publicidad
            element.addEventListener('load', function() {
              if (this.src && (this.src.includes('ad') || this.src.includes('popup'))) {
                console.log('🚫 Iframe publicitario bloqueado:', this.src);
                this.style.display = 'none';
              }
            });
          }
          return element;
        };
        
        // Método 6: Bloquear alerts y confirms molestos
        window.alert = function(msg) {
          console.log('🚫 Alert bloqueado:', msg);
          return false;
        };
        
        window.confirm = function(msg) {
          console.log('🚫 Confirm bloqueado:', msg);
          return false;
        };
        
        // Método 7: Prevenir redirecciones automáticas
        let originalLocation = window.location.href;
        Object.defineProperty(window.location, 'href', {
          set: function(url) {
            if (url !== originalLocation && !url.includes(window.location.hostname)) {
              console.log('🚫 Redirección bloqueada:', url);
              return false;
            }
            originalLocation = url;
          },
          get: function() {
            return originalLocation;
          }
        });
        
        // Método 8: Interceptar eventos de teclado para popups
        document.addEventListener('keydown', function(e) {
          // Bloquear Ctrl+Click, Shift+Click, etc.
          if ((e.ctrlKey || e.shiftKey) && e.target.tagName === 'A') {
            console.log('🚫 Combinación de teclas para popup bloqueada');
            e.preventDefault();
            return false;
          }
        });
        
        // Método 9: Limpiar timers sospechosos
        const originalSetTimeout = window.setTimeout;
        const originalSetInterval = window.setInterval;
        
        window.setTimeout = function(func, delay) {
          if (typeof func === 'string' && (func.includes('window.open') || func.includes('popup'))) {
            console.log('🚫 setTimeout con popup bloqueado');
            return null;
          }
          return originalSetTimeout.apply(this, arguments);
        };
        
        window.setInterval = function(func, delay) {
          if (typeof func === 'string' && (func.includes('window.open') || func.includes('popup'))) {
            console.log('🚫 setInterval con popup bloqueado');
            return null;
          }
          return originalSetInterval.apply(this, arguments);
        };
        
        // Método 10: Ocultar elementos publicitarios comunes
        function hideAds() {
          const adSelectors = [
            '[id*="ad"]',
            '[class*="ad"]',
            '[id*="popup"]',
            '[class*="popup"]',
            '[id*="banner"]',
            '[class*="banner"]',
            '.advertisement',
            '.ad-container',
            '.popup-overlay'
          ];
          
          adSelectors.forEach(selector => {
            try {
              const elements = document.querySelectorAll(selector);
              elements.forEach(el => {
                if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                  console.log('🚫 Elemento publicitario ocultado:', selector);
                  el.style.display = 'none !important';
                  el.style.visibility = 'hidden !important';
                  el.style.opacity = '0 !important';
                }
              });
            } catch (e) {
              // Ignorar errores
            }
          });
        }
        
        // Ejecutar limpieza cada segundo
        setInterval(hideAds, 1000);
        
        // Ejecutar limpieza inicial después de carga
        document.addEventListener('DOMContentLoaded', hideAds);
        setTimeout(hideAds, 2000);
        setTimeout(hideAds, 5000);
        
        console.log('✅ Bloqueo anti-popup activado');
        
        // Enviar confirmación a React Native
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage('popup-blocker-ready');
        }
      })();
      
      true; // Importante para WebView
    `;

    return (
      <View style={styles.videoContainer}>
        <WebView
          ref={webViewRef}
          style={styles.video}
          source={{ uri: processedUrl }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo={true}
          startInLoadingState={true}
          injectedJavaScript={injectedJavaScript}
          onMessage={(event) => {
            const data = event.nativeEvent.data;
            if (data === 'popup-blocker-ready') {
              console.log('✅ Bloqueo anti-popup activado en WebView');
            } else {
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'blocked') {
                  setBlockedPopups(parsed.count);
                }
              } catch (e) {
                // Mensaje no JSON
              }
            }
          }}
          userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color="#9D50BB" />
              <Text style={styles.loadingText}>Cargando reproductor...</Text>
              <Text style={styles.loadingSubtext}>Activando bloqueo anti-popup</Text>
            </View>
          )}
          onLoadStart={() => {
            setIsLoading(true);
            console.log('🔄 Cargando WebView con bloqueo anti-popup');
          }}
          onLoadEnd={() => {
            setIsLoading(false);
            console.log('✅ WebView cargado con protección');
          }}
          onError={(error) => {
            console.error('❌ Error en WebView:', error);
            setError('Error cargando el reproductor embed');
            setIsLoading(false);
          }}
          onHttpError={(event) => {
            console.error('❌ HTTP Error en WebView:', event.nativeEvent);
            setError('Error de conexión con el servidor');
            setIsLoading(false);
          }}
          // Configuraciones adicionales para evitar detección
          bounces={false}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
        />

        {/* Botón de cerrar para WebView */}
        <View style={styles.webViewControls}>
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.8)', 'transparent']}
            style={styles.webViewTopBar}
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
              style={styles.refreshButton} 
              onPress={() => {
                console.log('🔄 Recargando WebView');
                webViewRef.current?.reload();
              }}
            >
              <Ionicons name="refresh" size={24} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.shieldButton} 
              onPress={() => {
                Alert.alert(
                  '🛡️ Protección Activa',
                  `Bloqueo anti-popup activado\n• ${blockedPopups} popups bloqueados\n• Publicidad filtrada\n• Redirecciones prevenidas`,
                  [
                    { text: 'OK' },
                    { 
                      text: 'Modo Ultra Seguro', 
                      onPress: () => setShowUltraSecure(true) 
                    }
                  ]
                );
              }}
            >
              <Ionicons name="shield-checkmark" size={24} color="#9D50BB" />
              {blockedPopups > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{blockedPopups}</Text>
                </View>
              )}
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    );
  };

  // Renderizar pantalla de carga
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <LinearGradient
        colors={['rgba(157, 80, 187, 0.9)', 'rgba(123, 45, 158, 0.9)']}
        style={styles.loadingBackground}
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Detectando tipo de video...</Text>
        <Text style={styles.loadingSubtext}>
          {title ? `Preparando "${title}"` : 'Analizando enlace'}
        </Text>
      </LinearGradient>
    </View>
  );

  // Renderizar pantalla de error
  const renderError = () => (
    <View style={styles.errorContainer}>
      <LinearGradient
        colors={['rgba(157, 80, 187, 0.9)', 'rgba(123, 45, 158, 0.9)']}
        style={styles.errorBackground}
      >
        <Ionicons name="alert-circle" size={60} color="#fff" />
        <Text style={styles.errorTitle}>Error al cargar video</Text>
        <Text style={styles.errorText}>{error}</Text>
        
        <View style={styles.errorButtons}>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => detectAndProcessUrl(videoSource)}
          >
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.closeErrorButton} 
            onPress={handleClose}
          >
            <Text style={styles.closeErrorButtonText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={handleClose}
    >
      <StatusBar hidden />
      
      <View style={styles.container}>
        {playerType === 'loading' && renderLoading()}
        {playerType === 'native' && renderNativePlayer()}
        {playerType === 'webview' && renderWebViewPlayer()}
        {playerType === 'error' && renderError()}
        
        {/* Overlay de protección ultra segura */}
        <PopupBlockerOverlay
          visible={showUltraSecure}
          onClose={() => setShowUltraSecure(false)}
          url={processedUrl}
          title={title || 'Reproductor Ultra Seguro'}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
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
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  
  titleContainer: {
    flex: 1,
    marginLeft: 15,
  },
  
  videoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  
  videoSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  
  centerPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
  },
  
  centerPlayBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  
  // Estilos para WebView
  webViewControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  
  webViewTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    marginLeft: 10,
  },
  
  shieldButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(157, 80, 187, 0.2)',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.5)',
    position: 'relative',
  },
  
  badgeContainer: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  webViewLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A0225',
  },
  
  // Estilos para pantallas de carga y error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  loadingBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
  },
  
  loadingSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  errorBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
  },
  
  errorText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  errorButtons: {
    flexDirection: 'row',
    marginTop: 30,
    gap: 15,
  },
  
  retryButton: {
    backgroundColor: '#9D50BB',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  closeErrorButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  
  closeErrorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EmbedVideoPlayer;
