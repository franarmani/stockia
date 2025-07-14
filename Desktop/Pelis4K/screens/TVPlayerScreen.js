import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Dimensions
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const TVPlayerScreen = ({ route, navigation }) => {
  const { channel } = route.params;
  const [selectedServer, setSelectedServer] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showServerSelector, setShowServerSelector] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  // Obtener lista de servidores disponibles
  const servers = Array.isArray(channel.iframeUrl) ? channel.iframeUrl : [channel.iframeUrl];
  
  useEffect(() => {
    // Detectar si es un evento en vivo
    detectLiveEvent();
  }, [selectedServer]);

  const detectLiveEvent = () => {
    setConnectionStatus('connecting');
    // Simular detección de evento en vivo
    setTimeout(() => {
      setIsLive(true);
      setConnectionStatus('live');
    }, 2000);
  };

  const handleServerChange = (serverIndex) => {
    setSelectedServer(serverIndex);
    setIsLoading(true);
    setShowServerSelector(false);
    detectLiveEvent();
  };

  const getServerName = (url, index) => {
    if (url.includes('streamtpglobal')) return `Servidor Principal`;
    if (url.includes('dtvlivegratis')) return `Servidor Alternativo`;
    if (url.includes('elcanaldeportivo')) return `Servidor Deportivo`;
    if (url.includes('rereyano')) return `Servidor Premium`;
    if (url.includes('domainparatodo')) return `Servidor Backup`;
    if (url.includes('youtube')) return `YouTube`;
    if (url.includes('twitch')) return `Twitch`;
    if (url.includes('dailymotion')) return `Dailymotion`;
    return `Servidor ${index + 1}`;
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'live': return '#00ff88';
      case 'connecting': return '#ffaa00';
      case 'offline': return '#ff4444';
      default: return '#999999';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'live': return 'EN VIVO';
      case 'connecting': return 'CONECTANDO...';
      case 'offline': return 'DESCONECTADO';
      default: return 'VERIFICANDO...';
    }
  };

  const webViewHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            }
            iframe {
                width: 100%;
                height: 100vh;
                border: none;
                display: block;
                border-radius: 0;
                box-shadow: 0 0 50px rgba(157, 80, 187, 0.1);
            }
            .player-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
                z-index: 999;
                background: linear-gradient(
                    180deg, 
                    rgba(0,0,0,0.3) 0%, 
                    transparent 15%, 
                    transparent 85%, 
                    rgba(0,0,0,0.3) 100%
                );
            }
            .loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, #000 0%, #1a0225 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                z-index: 1000;
                backdrop-filter: blur(20px);
            }
            .loading-spinner {
                width: 60px;
                height: 60px;
                border: 3px solid rgba(157, 80, 187, 0.3);
                border-top: 3px solid #9D50BB;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
                box-shadow: 0 0 20px rgba(157, 80, 187, 0.3);
            }
            .loading-text {
                color: #9D50BB;
                font-size: 16px;
                font-weight: 600;
                text-align: center;
                margin-bottom: 10px;
            }
            .loading-subtitle {
                color: rgba(157, 80, 187, 0.7);
                font-size: 14px;
                text-align: center;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Adblock selectivo profesional */
            .advertisement, .google-ad, .adsense,
            iframe[src*="doubleclick"], iframe[src*="googlesyndication"],
            [id*="google_ads"], [class*="google-ad"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }
        </style>
    </head>
    <body>
        <div class="loading-overlay" id="loadingOverlay">
            <div class="loading-spinner"></div>
            <div class="loading-text">Conectando con el servidor</div>
            <div class="loading-subtitle">Preparando transmisión en vivo...</div>
        </div>
        
        <div class="player-overlay">
        </div>
        
        <iframe 
            id="mainPlayer"
            src="${servers[selectedServer]}" 
            allowfullscreen
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; camera; microphone"
            referrerpolicy="no-referrer"
            style="display: none;"
        ></iframe>
        
        <script>
            // Protección selectiva profesional
            const originalOpen = window.open;
            window.open = function(url, name, specs) {
                if (url && url.includes(window.location.hostname)) {
                    return originalOpen.call(window, url, name, specs);
                }
                if (url && (url.includes('ads') || url.includes('popup'))) {
                    return null;
                }
                return originalOpen.call(window, url, name, specs);
            };

            const originalAlert = window.alert;
            window.alert = function(msg) {
                if (msg && msg.length > 200) {
                    return;
                }
                return originalAlert(msg);
            };

            function removeAds() {
                const adSelectors = [
                    '.advertisement', '.google-ad', '.adsense',
                    '[id*="google_ads"]', '[class*="google-ad"]',
                    'iframe[src*="doubleclick"]'
                ];
                
                adSelectors.forEach(selector => {
                    try {
                        document.querySelectorAll(selector).forEach(el => {
                            el.style.display = 'none';
                            el.style.visibility = 'hidden';
                        });
                    } catch (e) {}
                });
            }
            
            // Manejo profesional de carga
            const iframe = document.getElementById('mainPlayer');
            const loadingOverlay = document.getElementById('loadingOverlay');
            
            iframe.onload = function() {
                setTimeout(() => {
                    loadingOverlay.style.opacity = '0';
                    loadingOverlay.style.transition = 'opacity 0.5s ease-out';
                    setTimeout(() => {
                        loadingOverlay.style.display = 'none';
                        iframe.style.display = 'block';
                        iframe.style.opacity = '0';
                        iframe.style.transition = 'opacity 0.5s ease-in';
                        setTimeout(() => {
                            iframe.style.opacity = '1';
                        }, 100);
                    }, 500);
                }, 1000);
            };
            
            iframe.onerror = function() {
                loadingOverlay.innerHTML = \`
                    <div style="text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                        <div style="color: #ff4444; font-size: 18px; margin-bottom: 10px;">Error de Conexión</div>
                        <div style="color: rgba(255, 68, 68, 0.7); font-size: 14px;">No se pudo establecer conexión con el servidor</div>
                    </div>
                \`;
            };
            
            setInterval(removeAds, 5000);
            
            setInterval(() => {
                try {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'heartbeat',
                        timestamp: Date.now()
                    }));
                } catch (e) {}
            }, 30000);
            
            setTimeout(removeAds, 2000);
        </script>
    </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1f032b" translucent />
      
      {/* Header Profesional Elegante */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <View style={styles.backButtonGradient}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
        
        <View style={styles.channelInfo}>
          <View style={styles.channelTitleContainer}>
            <Text style={styles.channelName} numberOfLines={1}>
              {channel.title || channel.name}
            </Text>
            <View style={styles.channelSubtitle}>
              <Text style={styles.channelCategory}>{channel.categoria || 'Televisión'}</Text>
              <View style={styles.separator} />
              <Text style={styles.channelCountry}>{channel.pais || 'Global'}</Text>
            </View>
          </View>
          <View style={styles.statusContainer}>
            <View style={[styles.liveIndicator, { backgroundColor: getConnectionStatusColor() }]}>
              <View style={styles.liveDot} />
            </View>
            <Text style={styles.liveText}>{getConnectionStatusText()}</Text>
            <View style={styles.qualityIndicator}>
              <Ionicons name="videocam" size={10} color="#00ff88" />
              <Text style={styles.qualityText}>HD</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Selector de Servidores Mejorado */}
      {showServerSelector && (
        <View style={styles.serverSelector}>
          <View style={styles.serverSelectorHeader}>
            <Text style={styles.serverSelectorTitle}>Servidores Disponibles</Text>
            <TouchableOpacity 
              onPress={() => setShowServerSelector(false)}
              style={styles.closeServerSelector}
            >
              <Ionicons name="close" size={18} color="rgba(255, 255, 255, 0.7)" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.serverList}>
            {servers.map((server, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.serverItem,
                  selectedServer === index && styles.serverItemActive
                ]}
                onPress={() => handleServerChange(index)}
                activeOpacity={0.7}
              >
                <View style={styles.serverItemContent}>
                  <View style={styles.serverInfo}>
                    <View style={[
                      styles.serverDot,
                      { backgroundColor: selectedServer === index ? '#00ff88' : 'rgba(255, 255, 255, 0.3)' }
                    ]} />
                    <Text style={[
                      styles.serverName,
                      selectedServer === index && styles.serverNameActive
                    ]}>
                      {getServerName(server, index)}
                    </Text>
                  </View>
                  
                  <View style={styles.serverMeta}>
                    <View style={[
                      styles.serverStatus,
                      selectedServer === index && styles.serverStatusActive
                    ]}>
                      <Text style={[
                        styles.serverStatusText,
                        selectedServer === index && styles.serverStatusTextActive
                      ]}>
                        HD
                      </Text>
                    </View>
                    
                    {selectedServer === index && (
                      <View style={styles.activeIcon}>
                        <Ionicons name="checkmark-circle" size={16} color="#00ff88" />
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          
          {servers.length === 1 && (
            <View style={styles.singleServerInfo}>
              <Ionicons name="information-circle-outline" size={16} color="rgba(255, 255, 255, 0.5)" />
              <Text style={styles.singleServerText}>Solo hay un servidor disponible</Text>
            </View>
          )}
        </View>
      )}

      {/* Info del Canal Compacta */}
      <View style={styles.channelDetails}>
        <View style={styles.channelBadges}>
          <View style={styles.compactBadge}>
            <Ionicons name="tv" size={10} color="#9D50BB" />
            <Text style={styles.compactText}>{channel.categoria || 'TV'}</Text>
          </View>
          
          <View style={styles.compactBadge}>
            <Ionicons name="globe" size={10} color="#9D50BB" />
            <Text style={styles.compactText}>{channel.pais || 'Global'}</Text>
          </View>
          
          <View style={styles.compactBadge}>
            <Ionicons name="videocam" size={10} color="#9D50BB" />
            <Text style={styles.compactText}>HD</Text>
          </View>
        </View>
      </View>

      {/* Reproductor Elegante */}
      <View style={styles.playerContainer}>
        {isLoading && (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingContent}>
              <View style={styles.loadingSpinner}>
                <ActivityIndicator size="large" color="#9D50BB" />
              </View>
              <Text style={styles.loadingTitle}>Conectando al servidor</Text>
              <Text style={styles.loadingSubtitle}>Preparando transmisión...</Text>
              
              <View style={styles.loadingProgress}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill]} />
                </View>
                <Text style={styles.progressText}>Estableciendo conexión...</Text>
              </View>
            </View>
          </View>
        )}
        
        <WebView
          source={{ html: webViewHTML }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          scalesPageToFit={true}
          allowsInlineMediaPlaybook={true}
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo={true}
          onShouldStartLoadWithRequest={(request) => {
            const url = request.url.toLowerCase();
            if (url.includes('popup') || 
                url.includes('advertisement') ||
                url.includes('malware') ||
                url.includes('scam')) {
              return false;
            }
            return true;
          }}
          originWhitelist={['*']}
          mixedContentMode="compatibility"
          allowsProtectedMedia={true}
          onLoadEnd={() => setIsLoading(false)}
          onError={(error) => {
            console.error('WebView error:', error);
            Alert.alert(
              'Error de Conexión',
              'No se pudo conectar al servidor. ¿Deseas cambiar a otro servidor?',
              [
                { text: 'Cancelar', style: 'cancel' },
                { 
                  text: 'Cambiar Servidor', 
                  onPress: () => setShowServerSelector(true) 
                }
              ]
            );
          }}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'liveStatus') {
                setIsLive(data.isLive);
                setConnectionStatus(data.isLive ? 'live' : 'offline');
              } else if (data.type === 'heartbeat') {
                setConnectionStatus('live');
              }
            } catch (error) {
              // Silencioso
            }
          }}
        />
      </View>

      {/* Controles Premium */}
      <View style={styles.controls}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => {
            setIsLoading(true);
            detectLiveEvent();
          }}
          activeOpacity={0.8}
        >
          <View style={styles.refreshButtonGradient}>
            <Ionicons name="refresh" size={14} color="#fff" />
            <Text style={styles.refreshButtonText}>Actualizar</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setShowServerSelector(!showServerSelector)}
          activeOpacity={0.8}
        >
          <View style={styles.serverButtonControlGradient}>
            <Ionicons name="settings" size={14} color="#fff" />
            <Text style={styles.serverButtonControlText}>Servidores</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => {
            // Funcionalidad de pantalla completa
          }}
          activeOpacity={0.8}
        >
          <View style={styles.fullscreenButtonGradient}>
            <Ionicons name="expand" size={14} color="#fff" />
            <Text style={styles.fullscreenButtonText}>Pantalla Completa</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f032b',
  },
  
  // Header Moderno Mejorado
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(31, 3, 43, 0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 80, 187, 0.15)',
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    marginRight: 18,
  },
  backButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  channelInfo: {
    flex: 1,
  },
  channelTitleContainer: {
    marginBottom: 8,
    paddingTop: 4,
    paddingLeft: 4,
    paddingRight: 12,
  },
  channelName: {
    fontSize: 16, // Reducido de 18 a 16
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  channelSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelCategory: {
    fontSize: 10,
    color: '#9D50BB',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  separator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 8,
  },
  channelCountry: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    fontSize: 10,
    color: '#00ff88',
    fontWeight: '700',
    letterSpacing: 0.6,
    marginRight: 10,
    textShadowColor: 'rgba(0, 255, 136, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  qualityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  qualityText: {
    fontSize: 10,
    color: '#00ff88',
    fontWeight: '600',
    marginLeft: 4,
    letterSpacing: 0.3,
  },

  // Selector de Servidores Minimalista
  serverSelector: {
    backgroundColor: 'rgba(31, 3, 43, 0.98)',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 80, 187, 0.1)',
  },
  serverSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  serverSelectorTitle: {
    fontSize: 14, // Reducido de 16 a 14
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  closeServerSelector: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  serverList: {
    paddingHorizontal: 20,
  },
  serverItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  serverItemActive: {
    backgroundColor: 'rgba(157, 80, 187, 0.15)',
    borderColor: '#9D50BB',
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  serverItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  serverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serverDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  serverName: {
    fontSize: 13, // Reducido de 15 a 13
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.2,
  },
  serverNameActive: {
    color: '#fff',
    fontWeight: '700',
  },
  serverMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serverStatus: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  serverStatusActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
  },
  serverStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.3,
  },
  serverStatusTextActive: {
    color: '#00ff88',
  },
  activeIcon: {
    marginLeft: 4,
  },
  singleServerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  singleServerText: {
    fontSize: 11, // Reducido de 13 a 11
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
    marginLeft: 6,
    fontStyle: 'italic',
  },

  // Canal Info Compacto
  channelDetails: {
    paddingHorizontal: 20,
    paddingVertical: 8, // Reducido de 16 a 8
    backgroundColor: 'rgba(26, 2, 37, 0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 80, 187, 0.1)',
  },
  channelBadges: {
    flexDirection: 'row',
    justifyContent: 'center', // Centrado en lugar de space-between
    alignItems: 'center',
    gap: 8, // Espaciado pequeño entre badges
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(157, 80, 187, 0.1)',
    paddingHorizontal: 8, // Más pequeño
    paddingVertical: 4, // Más pequeño
    borderRadius: 8, // Más pequeño
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.2)',
  },
  compactText: {
    fontSize: 8, // Reducido de 9 a 8
    color: '#9D50BB',
    fontWeight: '600',
    marginLeft: 4,
    letterSpacing: 0.2,
  },

  // Reproductor Premium
  playerContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#1f032b',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  webView: {
    flex: 1,
    backgroundColor: '#1f032b',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingSpinner: {
    marginBottom: 24,
  },
  loadingTitle: {
    color: '#fff',
    fontSize: 16, // Reducido de 18 a 16
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  loadingSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13, // Reducido de 15 a 13
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 0.3,
  },
  loadingProgress: {
    width: width * 0.7,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(157, 80, 187, 0.2)',
    borderRadius: 2,
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#9D50BB',
    borderRadius: 2,
    width: '70%',
  },
  progressText: {
    color: 'rgba(157, 80, 187, 0.8)',
    fontSize: 10, // Reducido de 12 a 10
    fontWeight: '600',
  },

  // Controles Compactos y Elegantes
  controls: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(31, 3, 43, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(157, 80, 187, 0.2)',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  controlButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  refreshButtonGradient: {
    backgroundColor: '#9D50BB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
    justifyContent: 'center',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 9, // Reducido de 11 a 9
    fontWeight: '600',
    marginLeft: 4,
    letterSpacing: 0.2,
  },
  serverButtonControlGradient: {
    backgroundColor: '#9D50BB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
    justifyContent: 'center',
  },
  serverButtonControlText: {
    color: '#fff',
    fontSize: 9, // Reducido de 11 a 9
    fontWeight: '600',
    marginLeft: 4,
    letterSpacing: 0.2,
  },
  fullscreenButtonGradient: {
    backgroundColor: '#7B2D9E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
    justifyContent: 'center',
  },
  fullscreenButtonText: {
    color: '#fff',
    fontSize: 9, // Reducido de 11 a 9
    fontWeight: '600',
    marginLeft: 4,
    letterSpacing: 0.2,
  },
});

export default TVPlayerScreen;
