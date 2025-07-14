import { useEffect, useRef, useState } from 'react';
import adBlocker from '../utils/adBlocker';
import usePopupBlocker from './usePopupBlocker';

const useProtectedIframe = (src, options = {}) => {
  const iframeRef = useRef(null);
  const containerRef = useRef(null);
  const [retryCount, setRetryCount] = useState(0);
  const { cleanupOnUnmount = true, maxRetries = 3 } = options;

  // Activar protección anti-popup específica para móviles
  const { blockedCount, isMobile } = usePopupBlocker(true, {
    aggressiveMode: true, // Modo agresivo en móviles
    preventNavigation: true,
    blockClickjacking: true
  });
  useEffect(() => {
    // Only protect iframe when we have a valid src and iframe ref, and src is not a TMDB URL
    if (iframeRef.current && src && !src.includes('tmdb.org')) {
      console.log('🛡️ Protecting iframe with URL:', src);
      console.log('📱 Mobile detected:', isMobile, '| Popups blocked:', blockedCount);
      
      // Apply protection specifically to this iframe without global initialization
      adBlocker.protectIframe(iframeRef.current);
      
      // Apply mobile-specific popup blocking for this iframe context
      const iframe = iframeRef.current;
      
      // Enhanced mobile protection
      if (isMobile) {
        console.log('📱 Applying enhanced mobile protection...');
        
        // Prevenir touch events que abren popups
        iframe.addEventListener('touchstart', (e) => {
          // Bloquear si es un touch muy rápido o múltiple
          if (e.touches.length > 1) {
            console.log('🚫📱 Multi-touch bloqueado en iframe');
            e.preventDefault();
            e.stopPropagation();
          }
        }, { passive: false });

        // Prevenir gestos que abren popups
        iframe.addEventListener('gesturestart', (e) => {
          console.log('🚫📱 Gesto bloqueado en iframe');
          e.preventDefault();
          e.stopPropagation();
        }, { passive: false });
      }
      
      // Error handler for iframe loading issues (including error 232011)
      const handleIframeError = (e) => {
        console.error('❌ Iframe error (possibly 232011):', e);
        console.log('Failed URL:', src);
        
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying iframe load... (${retryCount + 1}/${maxRetries})`);
          setTimeout(() => {
            if (iframe && iframe.contentWindow) {
              iframe.src = src; // Force reload
              setRetryCount(prev => prev + 1);
            }
          }, 2000);
        } else {
          console.error('❌ Max retries reached for iframe loading');
        }
      };
        // Success handler
      const handleIframeLoad = () => {
        console.log('✅ Iframe loaded successfully');
        setRetryCount(0); // Reset retry count on successful load
        
        try {
          if (iframe.contentWindow) {
            // Bloquear window.open en el contexto del iframe
            iframe.contentWindow.open = function(url, name, specs) {
              console.log('🚫📱 Blocked popup from protected iframe:', url);
              return null;
            };

            // Mobile-specific: Bloquear métodos adicionales de apertura de ventanas
            if (isMobile) {
              // Bloquear focus forzado (técnica común en móviles)
              iframe.contentWindow.focus = function() {
                console.log('🚫📱 Blocked forced focus from iframe');
                return false;
              };

              // Bloquear blur (puede usarse para detectar cambios de ventana)
              iframe.contentWindow.blur = function() {
                console.log('🚫📱 Blocked blur from iframe');
                return false;
              };

              // Interceptar intentos de cambio de location
              try {
                const originalReplace = iframe.contentWindow.location.replace;
                iframe.contentWindow.location.replace = function(url) {
                  console.log('🚫📱 Blocked location.replace from iframe:', url);
                  return false;
                };
              } catch (err) {
                // Cross-origin restriction, expected
              }
            }
          }
        } catch (err) {
          console.log('ℹ️ Cannot access iframe content (cross-origin protection active)');
        }
      };
      
      iframe.addEventListener('load', handleIframeLoad);
      iframe.addEventListener('error', handleIframeError);
      
      // Return cleanup function for this specific iframe
      return () => {
        iframe.removeEventListener('load', handleIframeLoad);
        iframe.removeEventListener('error', handleIframeError);
      };
    }
  }, [src, cleanupOnUnmount, retryCount, maxRetries]);
  return {
    iframeRef,
    containerRef,
    retryCount,
    blockedCount,
    isMobile
  };
};

export default useProtectedIframe;
