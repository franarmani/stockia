import { useEffect, useRef, useState } from 'react';

/**
 * Hook específico para bloquear popups en móviles desde iframes
 * Implementa múltiples capas de protección contra popups agresivos
 */
const usePopupBlocker = (isActive = true, options = {}) => {
  const [blockedCount, setBlockedCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const windowOpenRef = useRef(null);
  const locationAssignRef = useRef(null);
  const eventListenersRef = useRef([]);

  const {
    aggressiveMode = true, // Modo agresivo para móviles
    logBlocked = true,
    preventNavigation = true,
    blockClickjacking = true
  } = options;

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      return mobileRegex.test(userAgent) || window.innerWidth <= 768;
    };

    setIsMobile(checkMobile());

    const handleResize = () => {
      setIsMobile(checkMobile());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Función para incrementar contador de bloqueos
  const incrementBlocked = (type = 'popup') => {
    setBlockedCount(prev => prev + 1);
    if (logBlocked) {
      console.log(`🚫📱 Popup bloqueado en móvil (${type}):`, new Date().toLocaleTimeString());
    }
  };
  // Bloquear window.open
  const blockWindowOpen = () => {
    if (windowOpenRef.current) return; // Ya está bloqueado

    windowOpenRef.current = window.open;
    window.open = function(url, name, specs) {
      // Lista de dominios de streaming legítimos que NO deben bloquearse
      const legitimateStreamingDomains = [
        'mixdrop.co', 'mixdrop.to', 'mixdrop.my', 'mixdrop.sx',
        'streamtape.com', 'doodstream.com', 'upstream.to',
        'voe.sx', 'streamlare.com', 'supervideo.tv',
        'uptostream.com', 'embedgram.com', 'streamhub.to',
        'mp4upload.com', 'videobin.co', 'userload.co'
      ];

      // Verificar si la URL es de un servicio de streaming legítimo
      if (url) {
        const isLegitimateStreaming = legitimateStreamingDomains.some(domain => 
          url.includes(domain)
        );
        
        // Si es streaming legítimo, permitir pero logear
        if (isLegitimateStreaming) {
          console.log('✅ Permitiendo popup de streaming legítimo:', url);
          return windowOpenRef.current.apply(this, arguments);
        }
      }

      incrementBlocked('window.open');
      
      // En móviles, ser más selectivo pero aún proteger contra ads
      if (isMobile || aggressiveMode) {
        // Lista de patrones de ads conocidos
        const adPatterns = [
          'doubleclick', 'googlesyndication', 'googleadservices',
          'popads', 'popcash', 'propellerads', 'outbrain', 'taboola',
          'adskeeper', 'mgid', 'revcontent', 'clicksor', 'infolinks'
        ];

        const isAd = adPatterns.some(pattern => 
          url && url.toLowerCase().includes(pattern)
        );

        if (isAd || !url) {
          console.log('🚫📱 Popup publicitario bloqueado:', url);
          return null;
        }
      }
      
      console.log('🚫 Popup bloqueado:', url);
      return null;
    };
  };
  // Bloquear navegación forzada
  const blockForcedNavigation = () => {
    if (!preventNavigation || locationAssignRef.current) return;

    locationAssignRef.current = Location.prototype.assign;
    Location.prototype.assign = function(url) {
      if (url && typeof url === 'string') {
        // Lista de dominios de streaming que NO deben bloquearse
        const legitimateStreamingDomains = [
          'mixdrop.co', 'mixdrop.to', 'mixdrop.my', 'mixdrop.sx',
          'streamtape.com', 'doodstream.com', 'upstream.to',
          'voe.sx', 'streamlare.com', 'supervideo.tv',
          'tmdb.org', 'localhost'
        ];

        // Verificar si es navegación a streaming legítimo
        const isLegitimateStreaming = legitimateStreamingDomains.some(domain => 
          url.includes(domain)
        );

        if (isLegitimateStreaming) {
          console.log('✅ Permitiendo navegación a streaming legítimo:', url);
          return locationAssignRef.current.apply(this, arguments);
        }

        // Lista de dominios sospechosos (solo ads conocidos)
        const suspiciousDomains = [
          'popads', 'popcash', 'propellerads', 'doubleclick', 'googlesyndication',
          'outbrain', 'taboola', 'mgid', 'revcontent', 'adskeeper', 'clicksor',
          'infolinks', 'bidvertiser', 'chitika', 'linkbucks', 'adf.ly'
        ];

        const isSuspicious = suspiciousDomains.some(domain => 
          url.toLowerCase().includes(domain)
        );

        if (isSuspicious) {
          incrementBlocked('navigation');
          console.log('🚫📱 Navegación publicitaria bloqueada:', url);
          return;
        }
      }
      
      return locationAssignRef.current.apply(this, arguments);
    };
  };

  // Bloquear eventos táctiles sospechosos (específico para móviles)
  const blockSuspiciousTouchEvents = () => {
    if (!isMobile) return;

    // Bloquear touches múltiples rápidos (técnica común de clickjacking)
    let lastTouchTime = 0;
    let touchCount = 0;

    const handleTouchStart = (e) => {
      const currentTime = Date.now();
      if (currentTime - lastTouchTime < 100) { // Touches muy rápidos
        touchCount++;
        if (touchCount > 3) { // Más de 3 touches en menos de 300ms
          e.preventDefault();
          e.stopPropagation();
          incrementBlocked('suspicious-touch');
          console.log('🚫📱 Touch sospechoso bloqueado');
          return false;
        }
      } else {
        touchCount = 0;
      }
      lastTouchTime = currentTime;
    };

    // Bloquear clics en elementos transparentes o muy pequeños
    const handleClick = (e) => {
      const element = e.target;
      const styles = window.getComputedStyle(element);
      
      // Elemento muy pequeño o transparente
      if (element.offsetWidth < 3 || element.offsetHeight < 3 || 
          styles.opacity === '0' || 
          styles.visibility === 'hidden') {
        
        e.preventDefault();
        e.stopPropagation();
        incrementBlocked('invisible-click');
        console.log('🚫📱 Clic en elemento invisible bloqueado');
        return false;
      }

      // Verificar si el clic es en un iframe sospechoso
      if (element.tagName === 'IFRAME') {
        const src = element.src || '';
        const suspiciousPatterns = [
          '/ads/', '/popup/', '/banner/', '/ad.', '.ads.', 'doubleclick', 'googlesyndication'
        ];

        if (suspiciousPatterns.some(pattern => src.includes(pattern))) {
          e.preventDefault();
          e.stopPropagation();
          incrementBlocked('iframe-click');
          console.log('🚫📱 Clic en iframe publicitario bloqueado');
          return false;
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
    document.addEventListener('click', handleClick, { passive: false, capture: true });

    eventListenersRef.current.push(
      () => document.removeEventListener('touchstart', handleTouchStart, { capture: true }),
      () => document.removeEventListener('click', handleClick, { capture: true })
    );
  };

  // Proteger contra clickjacking
  const protectAgainstClickjacking = () => {
    if (!blockClickjacking) return;

    // Agregar estilos anti-clickjacking
    const style = document.createElement('style');
    style.textContent = `
      /* Protección anti-clickjacking específica para móviles */
      iframe[width="1"][height="1"],
      iframe[width="0"][height="0"],
      iframe[style*="position: absolute"][style*="top: -"],
      iframe[style*="position: fixed"][style*="top: -"],
      iframe[style*="opacity: 0"],
      iframe[style*="visibility: hidden"] {
        display: none !important;
        pointer-events: none !important;
      }

      /* Prevenir overlays invisibles en móviles */
      *[style*="position: absolute"][style*="z-index"][style*="opacity: 0"],
      *[style*="position: fixed"][style*="z-index"][style*="opacity: 0"] {
        pointer-events: none !important;
      }

      /* Protección específica para móviles */
      @media (max-width: 768px) {
        /* Prevenir elementos que cubren toda la pantalla */
        *[style*="width: 100%"][style*="height: 100%"][style*="position: absolute"],
        *[style*="width: 100vw"][style*="height: 100vh"][style*="position: fixed"] {
          pointer-events: none !important;
        }
      }
    `;
    
    document.head.appendChild(style);
    
    eventListenersRef.current.push(() => {
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    });
  };

  // Monitorear y bloquear nuevos iframes sospechosos
  const monitorSuspiciousIframes = () => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.tagName === 'IFRAME') {
            const src = node.src || '';
            const suspiciousPatterns = [
              'popads', 'popcash', 'propellerads', 'doubleclick', 'googlesyndication',
              'outbrain', 'taboola', '/ads/', '/popup/', '/banner/'
            ];

            if (suspiciousPatterns.some(pattern => src.includes(pattern))) {
              node.style.display = 'none';
              node.style.pointerEvents = 'none';
              incrementBlocked('iframe-injection');
              console.log('🚫📱 Iframe publicitario bloqueado:', src);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    eventListenersRef.current.push(() => observer.disconnect());
  };

  // Interceptar mensajes postMessage sospechosos
  const interceptSuspiciousMessages = () => {
    const handleMessage = (event) => {
      const data = event.data;
      
      // Patrones comunes en mensajes de popups
      if (typeof data === 'string') {
        const suspiciousPatterns = [
          'popup', 'redirect', 'navigate', 'open_window', 'ads', 'advertisement'
        ];

        if (suspiciousPatterns.some(pattern => 
          data.toLowerCase().includes(pattern))) {
          
          event.stopPropagation();
          incrementBlocked('postMessage');
          console.log('🚫📱 PostMessage sospechoso bloqueado:', data);
        }
      }
    };

    window.addEventListener('message', handleMessage, true);
    eventListenersRef.current.push(() => 
      window.removeEventListener('message', handleMessage, true)
    );
  };

  // Activar protecciones
  useEffect(() => {
    if (!isActive) return;

    console.log('🛡️📱 Iniciando protección anti-popup para móviles...');

    blockWindowOpen();
    blockForcedNavigation();
    protectAgainstClickjacking();
    monitorSuspiciousIframes();
    interceptSuspiciousMessages();
    
    if (isMobile) {
      blockSuspiciousTouchEvents();
    }

    // Cleanup function
    return () => {
      // Restaurar window.open original
      if (windowOpenRef.current) {
        window.open = windowOpenRef.current;
        windowOpenRef.current = null;
      }

      // Restaurar Location.assign original
      if (locationAssignRef.current) {
        Location.prototype.assign = locationAssignRef.current;
        locationAssignRef.current = null;
      }

      // Ejecutar todos los cleanups
      eventListenersRef.current.forEach(cleanup => cleanup());
      eventListenersRef.current = [];
    };
  }, [isActive, isMobile, aggressiveMode]);

  return {
    blockedCount,
    isMobile,
    isActive,
    resetCount: () => setBlockedCount(0)
  };
};

export default usePopupBlocker;
