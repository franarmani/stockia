import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const PopupBlockerOverlay = ({ 
  visible, 
  onClose, 
  url, 
  title = 'Reproductor Protegido' 
}) => {
  const [blockedCount, setBlockedCount] = useState(0);
  const [isSecureMode, setIsSecureMode] = useState(true);
  const webViewRef = useRef(null);

  // JavaScript ultra-agresivo para bloqueo total
  const secureJavaScript = `
    (function() {
      console.log('🛡️ MODO SEGURO ACTIVADO - Bloqueo total');
      
      let blockedAttempts = 0;
      
      // Función para reportar bloqueos
      function reportBlock(type, details) {
        blockedAttempts++;
        console.log('🚫 BLOQUEADO [' + blockedAttempts + '] ' + type + ':', details);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'blocked',
            count: blockedAttempts,
            method: type,
            details: details
          }));
        }
      }
      
      // NIVEL 1: Destruir window.open completamente
      delete window.open;
      Object.defineProperty(window, 'open', {
        value: function() {
          reportBlock('window.open', arguments[0]);
          return { focus: function() {}, close: function() {} };
        },
        writable: false,
        configurable: false,
        enumerable: false
      });
      
      // NIVEL 2: Interceptar TODOS los eventos
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (type === 'click' || type === 'mousedown' || type === 'touchstart') {
          const wrappedListener = function(event) {
            const target = event.target;
            if (target && (target.tagName === 'A' || target.closest('a'))) {
              const link = target.tagName === 'A' ? target : target.closest('a');
              if (link.target === '_blank' || 
                  link.href.includes('popup') ||
                  link.href.includes('ad') ||
                  link.href.includes('promo') ||
                  link.onclick && link.onclick.toString().includes('window.open')) {
                reportBlock('click-intercepted', link.href);
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                return false;
              }
            }
            return listener.call(this, event);
          };
          return originalAddEventListener.call(this, type, wrappedListener, options);
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
      
      // NIVEL 3: Bloquear modificaciones al DOM peligrosas
      const originalCreateElement = document.createElement;
      document.createElement = function(tagName) {
        const element = originalCreateElement.call(document, tagName);
        if (tagName.toLowerCase() === 'a') {
          element.addEventListener('click', function(e) {
            if (this.target === '_blank' || this.href.includes('popup')) {
              reportBlock('dynamic-link', this.href);
              e.preventDefault();
              return false;
            }
          });
        }
        return element;
      };
      
      // NIVEL 4: Interceptar y bloquear eval malicioso
      const originalEval = window.eval;
      window.eval = function(code) {
        if (code.includes('window.open') || code.includes('popup') || code.includes('_blank')) {
          reportBlock('eval-blocked', code.substring(0, 100));
          return null;
        }
        return originalEval.call(this, code);
      };
      
      // NIVEL 5: Bloquear Function constructor
      const OriginalFunction = window.Function;
      window.Function = function() {
        const code = Array.prototype.slice.call(arguments, -1)[0];
        if (code && (code.includes('window.open') || code.includes('popup'))) {
          reportBlock('Function-constructor', code.substring(0, 100));
          return function() { return null; };
        }
        return OriginalFunction.apply(this, arguments);
      };
      
      // NIVEL 6: Interceptar asignaciones de location
      let originalHref = window.location.href;
      Object.defineProperty(window.location, 'href', {
        set: function(value) {
          if (value !== originalHref && 
              (value.includes('popup') || 
               value.includes('ad') || 
               !value.includes(window.location.hostname))) {
            reportBlock('location-redirect', value);
            return false;
          }
        },
        get: function() { return originalHref; }
      });
      
      // NIVEL 7: Limpiar timers maliciosos
      const originalSetTimeout = window.setTimeout;
      const originalSetInterval = window.setInterval;
      
      window.setTimeout = function(func, delay) {
        if (typeof func === 'string') {
          if (func.includes('window.open') || func.includes('popup')) {
            reportBlock('setTimeout', func);
            return null;
          }
        } else if (typeof func === 'function') {
          const funcStr = func.toString();
          if (funcStr.includes('window.open') || funcStr.includes('popup')) {
            reportBlock('setTimeout-function', funcStr.substring(0, 100));
            return null;
          }
        }
        return originalSetTimeout.apply(this, arguments);
      };
      
      // NIVEL 8: Destruir elementos publicitarios
      function nukeAds() {
        const selectors = [
          '[id*="ad"]', '[class*="ad"]', '[id*="popup"]', '[class*="popup"]',
          '[id*="banner"]', '[class*="banner"]', '.advertisement', '.ad-container',
          '.popup-overlay', '[id*="promo"]', '[class*="promo"]', 'iframe[src*="ad"]'
        ];
        
        selectors.forEach(selector => {
          try {
            document.querySelectorAll(selector).forEach(el => {
              if (el.offsetWidth > 0 || el.offsetHeight > 0) {
                reportBlock('ad-element', selector);
                el.remove();
              }
            });
          } catch (e) {}
        });
      }
      
      // NIVEL 9: Observer para nuevos elementos
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element node
              if (node.tagName === 'A' && node.target === '_blank') {
                reportBlock('dynamic-blank-link', node.href);
                node.target = '_self';
              }
              if (node.tagName === 'IFRAME' && 
                  (node.src.includes('ad') || node.src.includes('popup'))) {
                reportBlock('dynamic-iframe', node.src);
                node.remove();
              }
            }
          });
        });
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Ejecutar limpieza continua
      setInterval(nukeAds, 500);
      
      // Confirmación de activación
      reportBlock('SYSTEM', 'Bloqueo ultra-seguro activado');
      
    })();
    true;
  `;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'blocked') {
        setBlockedCount(data.count);
      }
    } catch (e) {
      // Mensaje no JSON, ignorar
    }
  };

  const toggleSecureMode = () => {
    setIsSecureMode(!isSecureMode);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header con controles de seguridad */}
        <LinearGradient
          colors={['#1A0225', '#2D1B35']}
          style={styles.header}
        >
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              🛡️ Modo Seguro {isSecureMode ? 'ON' : 'OFF'} • {blockedCount} bloqueados
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.securityButton, isSecureMode && styles.securityButtonActive]} 
            onPress={toggleSecureMode}
          >
            <Ionicons 
              name={isSecureMode ? "shield-checkmark" : "shield-outline"} 
              size={24} 
              color={isSecureMode ? "#4CAF50" : "#fff"} 
            />
          </TouchableOpacity>
        </LinearGradient>

        {/* WebView con protección máxima */}
        <WebView
          ref={webViewRef}
          style={styles.webview}
          source={{ uri: url }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo={true}
          injectedJavaScript={isSecureMode ? secureJavaScript : ''}
          onMessage={handleMessage}
          userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          bounces={false}
          scrollEnabled={true}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          onError={(error) => {
            Alert.alert('Error', 'No se pudo cargar el contenido');
          }}
        />

        {/* Footer con estadísticas */}
        <LinearGradient
          colors={['#2D1B35', '#1A0225']}
          style={styles.footer}
        >
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
              <Text style={styles.statText}>{blockedCount} Bloqueados</Text>
            </View>
            
            <View style={styles.stat}>
              <Ionicons name="lock-closed" size={16} color="#9D50BB" />
              <Text style={styles.statText}>Protegido</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.infoButton}
              onPress={() => {
                Alert.alert(
                  '🛡️ Protección Activa',
                  `Bloqueos realizados: ${blockedCount}\n\n• Ventanas emergentes bloqueadas\n• Publicidad filtrada\n• Redirecciones prevenidas\n• Scripts maliciosos neutralizados\n• Enlaces peligrosos desactivados`,
                  [{ text: 'OK' }]
                );
              }}
            >
              <Ionicons name="information-circle" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 80, 187, 0.3)',
  },
  
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  
  titleContainer: {
    flex: 1,
    marginLeft: 15,
  },
  
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  
  subtitle: {
    fontSize: 12,
    color: '#9D50BB',
    marginTop: 2,
  },
  
  securityButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  
  securityButtonActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: '#4CAF50',
  },
  
  webview: {
    flex: 1,
  },
  
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(157, 80, 187, 0.3)',
  },
  
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(157, 80, 187, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.3)',
  },
  
  statText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  
  infoButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(157, 80, 187, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.5)',
  },
});

export default PopupBlockerOverlay;
