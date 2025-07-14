// Ad Blocker Service - Compatible with PC and Mobile
class AdBlockerService {  constructor() {    // Whitelist for essential domains (don't block these)
    this.whitelist = [
      'api.themoviedb.org',
      'image.tmdb.org',
      'www.themoviedb.org',
      'tmdb.org',
      'googleapis.com',
      'gstatic.com',
      'cloudflare.com',
      'jsdelivr.net',
      'unpkg.com',
      // Additional TMDB domains
      'themoviedb.org',
      'images.tmdb.org',      // Essential CDN and API domains
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'cdn.jsdelivr.net',
      'unpkg.com',
      'cdnjs.cloudflare.com',      // Streaming domains (no TEO+ wrapper)
      'canalesonline.netlify.app',
      'maafiaseries.netlify.app',
      'pelis4konline.netlify.app',
      'cinemaplus.netlify.app',
      'cineplex.netlify.app',
      'streamtape.com',
      'streamhub.to',
      'embedgram.com',
      'doodstream.com',
      'upstream.to',
      'uptostream.com',
      'voe.sx',
      'supervideo.tv',
      'streamlare.com',
      'mixdrop.co',
      'mixdrop.to', 
      'mixdrop.my',
      'mixdrop.sx',
      'mp4upload.com',
      'stream196tp.com',
      'gounlimited.to',
      'jetload.net',
      'videobin.co',
      'userload.co',
      'rapidvideo.com',
      'clipwatching.com',
      'powerwatch.pw',
      'streamsb.net',
      'sbplay.one',
      'sbplay.org',
      'playersb.com',
      'tubesb.com',
      // Local development
      'localhost',
      '127.0.0.1',
      '::1',
      // Common streaming platforms (legitimate)
      'vimeo.com',
      'youtube.com',
      'youtu.be',
      'dailymotion.com',
      'twitch.tv',
      'player.vimeo.com',
      'www.youtube.com'
    ];

    this.blockedDomains = [
      // Common ad networks
      'doubleclick.net',
      'googlesyndication.com',
      'googleadservices.com',
      'google-analytics.com',
      'googletagmanager.com',
      'facebook.com/tr',
      'connect.facebook.net',
      'amazon-adsystem.com',
      'adsystem.amazon.com',
      'media.net',
      'outbrain.com',
      'taboola.com',
      'criteo.com',
      'adskeeper.co.uk',
      'mgid.com',
      'propellerads.com',
      'popads.net',
      'popcash.net',
      'adnxs.com',
      'adsafe.it',
      'advertising.com',
      'ads.yahoo.com',
      'bing.com/ads',
      'yandex.ru/ads',
      // Video ad networks
      'imasdk.googleapis.com',
      'pubads.g.doubleclick.net',
      'securepubads.g.doubleclick.net',
      'tpc.googlesyndication.com',
      'partner.googleadservices.com',
      // Pop-up and redirect domains
      'popunder',
      'popup',
      'redirect',
      'clicksor.com',
      'infolinks.com',
      'chitika.com',
      'bidvertiser.com',
      'linkbucks.com',
      'adf.ly',
      'short.st',
      'ouo.io',
      'bc.vc',
      'adfly.com',
      // Analytics and tracking
      'hotjar.com',
      'mixpanel.com',
      'segment.com',
      'fullstory.com',
      'logrocket.com',
      'bugsnag.com',
      'sentry.io',
      'amplitude.com',
      // Social tracking
      'facebook.com/plugins',
      'platform.twitter.com',
      'apis.google.com/js/platform.js',
      'connect.facebook.net/en_US/fbevents.js',
      // Malicious domains (common patterns)
      'malware',
      'virus',
      'trojan',
      'phishing',
      'scam'
    ];

    this.adSelectors = [
      // Common ad container selectors
      '.ad', '.ads', '.advertisement', '.advertising',
      '[class*="ad-"]', '[id*="ad-"]', '[class*="ads-"]', '[id*="ads-"]',
      '.banner', '.popup', '.popunder', '.overlay',
      '.modal-backdrop', '.modal-overlay',
      // Video ad selectors
      '.video-ads', '.preroll', '.midroll', '.postroll',
      '.ima-ad-container', '.ads-container',
      '.ytp-ad-overlay-container', '.ytp-ad-text-overlay',
      // Pop-up selectors
      '.popup-overlay', '.popup-container', '.popup-modal',
      '.notification-popup', '.promo-popup',
      // Social widgets
      '.fb-like', '.twitter-follow', '.social-share',
      // Analytics scripts
      'script[src*="google-analytics"]',
      'script[src*="googletagmanager"]',
      'script[src*="facebook.com/tr"]',
      'script[src*="hotjar"]'
    ];

    this.isBlocking = false;
  }  // Initialize ad blocking (iframe-only mode)
  init() {
    // Only block popups, CSS ads, and analytics - NOT network requests to preserve streaming
    this.preventPopups();
    this.injectAdBlockCSS();
    this.blockAnalytics();
    // COMENTADO: No bloquear requests de red para preservar streaming
    // this.blockNetworkRequests();
    this.isBlocking = true;
    console.log('🛡️ Ad Blocker initialized (CSS + popup blocking only, preserving all network requests)');
  }
  // Block network requests to ad domains
  blockNetworkRequests() {
    const self = this;
    
    // Override fetch
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const url = args[0];
      if (self.shouldBlockUrl(url)) {
        console.log('🚫 Blocked fetch request:', url);
        return Promise.reject(new Error('Blocked by ad blocker'));
      }
      return originalFetch.apply(this, args);
    };

    // Override XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      if (self.shouldBlockUrl(url)) {
        console.log('🚫 Blocked XHR request:', url);
        return;
      }
      return originalOpen.apply(this, [method, url, ...rest]);
    };
  }  // Check if URL should be blocked
  shouldBlockUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    const urlLower = url.toLowerCase();
    
    // Check whitelist first - never block whitelisted domains
    const isWhitelisted = this.whitelist.some(domain => {
      const domainLower = domain.toLowerCase();
      return urlLower.includes(domainLower) || 
             urlLower.includes(`//${domainLower}`) ||
             urlLower.includes(`www.${domainLower}`) ||
             urlLower.includes(`https://${domainLower}`) ||
             urlLower.includes(`http://${domainLower}`);
    });
    
    if (isWhitelisted) {
      console.log('✅ URL whitelisted:', url);
      return false;
    }
      // Don't block streaming URLs or player URLs
    const isStreamingUrl = [
      'canalesonline.netlify.app',
      'stream196tp.com',
      'reproductor.html',
      '.m3u8',
      '.mp4',
      '.avi',
      '.mkv',
      'player',
      'stream',
      'video'
    ].some(pattern => urlLower.includes(pattern));
    
    if (isStreamingUrl) {
      console.log('🎬 Streaming URL preserved:', url);
      return false;
    }
    
    // Only block obvious ad domains
    const shouldBlock = this.blockedDomains.some(domain => {
      const domainLower = domain.toLowerCase();
      return urlLower.includes(domainLower) && 
             // Make sure it's actually an ad domain, not just containing the word
             (urlLower.includes(`//${domainLower}`) || 
              urlLower.includes(`www.${domainLower}`) ||
              urlLower.includes(`https://${domainLower}`) ||
              urlLower.includes(`http://${domainLower}`));
    });
    
    if (shouldBlock) {
      console.log('🚫 URL blocked:', url);
    }
    
    return shouldBlock;
  }  // Prevent pop-ups and redirects
  preventPopups() {
    const self = this;
    
    // Detectar si es móvil
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      navigator.userAgent
    ) || window.innerWidth <= 768;
    
    // Block window.open con protección móvil mejorada
    const originalOpen = window.open;
    window.open = function(url, name, specs) {
      console.log('🚫 Blocked popup:', url);
      
      // En móviles, bloquear TODOS los popups excepto casos muy específicos
      if (isMobile) {
        console.log('🚫📱 Mobile popup blocked aggressively:', url);
        return null;
      }
      
      return null;
    };

    // Block navigation attempts con protección móvil
    const originalAssign = Location.prototype.assign;
    Location.prototype.assign = function(url) {
      if (self.shouldBlockUrl(url)) {
        console.log('🚫 Blocked navigation:', url);
        return;
      }
      return originalAssign.apply(this, arguments);
    };

    // Block focus events que podrían indicar popups
    document.addEventListener('focus', (e) => {
      if (e.target !== window && e.target.tagName === 'IFRAME') {
        const iframe = e.target;
        try {
          // Check if iframe content might be an ad
          if (iframe.src && self.shouldBlockUrl(iframe.src)) {
            iframe.style.display = 'none';
            console.log('🚫 Hidden ad iframe:', iframe.src);
          }
        } catch (err) {
          // Cross-origin restrictions, ignore
        }
      }
    });

    // Protección específica para móviles
    if (isMobile) {
      console.log('📱 Applying mobile-specific popup protection...');
      
      // Bloquear touch events sospechosos
      let touchStartTime = 0;
      document.addEventListener('touchstart', (e) => {
        touchStartTime = Date.now();
      }, { passive: true });

      document.addEventListener('touchend', (e) => {
        const touchDuration = Date.now() - touchStartTime;
        
        // Touch muy rápido podría ser un intento de popup
        if (touchDuration < 50) {
          const element = e.target;
          if (element.tagName === 'IFRAME' || 
              element.closest('iframe') || 
              element.classList.contains('ad') ||
              element.id.includes('ad')) {
            console.log('🚫📱 Suspicious fast touch blocked');
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }, { passive: false, capture: true });

      // Interceptar gestos de pellizco/zoom que pueden disparar popups
      document.addEventListener('gesturestart', (e) => {
        if (e.target.tagName === 'IFRAME') {
          console.log('🚫📱 Gesture on iframe blocked');
          e.preventDefault();
        }
      }, { passive: false });
    }

    // Block click events on suspicious elements con protección móvil mejorada
    document.addEventListener('click', (e) => {
      const element = e.target;
      const href = element.href || element.getAttribute('href');
      
      if (href && self.shouldBlockUrl(href)) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🚫 Blocked click on ad link:', href);
        return false;
      }

      // Protección adicional para móviles
      if (isMobile) {
        // Verificar si el elemento es muy pequeño (posible clickjacking)
        if (element.offsetWidth < 5 || element.offsetHeight < 5) {
          console.log('🚫📱 Blocked click on tiny element (possible clickjacking)');
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        // Verificar si es un elemento invisible
        const styles = window.getComputedStyle(element);
        if (styles.opacity === '0' || styles.visibility === 'hidden') {
          console.log('🚫📱 Blocked click on invisible element');
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    }, true);

    // Interceptar mensajes postMessage sospechosos (común en móviles)
    window.addEventListener('message', (event) => {
      if (event.data && typeof event.data === 'string') {
        const suspiciousPatterns = [
          'popup', 'redirect', 'navigate', 'ads', 'advertisement', 
          'open_window', 'new_tab', 'click_ad'
        ];
        
        if (suspiciousPatterns.some(pattern => 
          event.data.toLowerCase().includes(pattern))) {
          console.log('🚫📱 Suspicious postMessage blocked:', event.data);
          event.stopPropagation();
        }
      }
    }, true);
  }
  // Inject CSS to hide ad elements
  injectAdBlockCSS() {
    const style = document.createElement('style');
    style.textContent = `
      /* Ensure TMDB images are always visible */
      img[src*="image.tmdb.org"],
      img[src*="images.tmdb.org"],
      img[src*="themoviedb.org"],
      img[src*="tmdb.org"] {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: static !important;
        left: auto !important;
        width: auto !important;
        height: auto !important;
        overflow: visible !important;
      }

      /* Hide common ad elements (but not TMDB content) */
      ${this.adSelectors.join(', ')} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        position: absolute !important;
        left: -9999px !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
      }

      /* Block iframe ads */
      iframe[src*="doubleclick"],
      iframe[src*="googlesyndication"],
      iframe[src*="googleadservices"],
      iframe[src*="amazon-adsystem"],
      iframe[src*="outbrain"],
      iframe[src*="taboola"],
      iframe[src*="propellerads"],
      iframe[src*="popads"] {
        display: none !important;
      }

      /* Hide overlay ads */
      .overlay-ad, .popup-ad, .banner-ad {
        display: none !important;
      }

      /* Block video ads */
      .video-ads, .preroll-ad, .midroll-ad {
        display: none !important;
      }

      /* Custom styles for better UX */
      body {
        overflow-x: hidden !important;
      }      /* Block suspicious iframes */
      iframe[width="1"][height="1"],
      iframe[width="0"][height="0"] {
        display: none !important;
      }

      /* Mobile-specific popup protection */
      @media (max-width: 768px) {
        /* Block overlay elements that cover the full screen on mobile */
        *[style*="position: fixed"][style*="z-index"][style*="width: 100%"],
        *[style*="position: absolute"][style*="z-index"][style*="width: 100%"] {
          pointer-events: none !important;
        }

        /* Block transparent overlays on mobile */
        *[style*="opacity: 0"][style*="position: absolute"],
        *[style*="opacity: 0"][style*="position: fixed"] {
          display: none !important;
          pointer-events: none !important;
        }

        /* Prevent invisible clickable areas */
        *[style*="width: 1px"][style*="height: 1px"],
        *[style*="width: 0"][style*="height: 0"] {
          display: none !important;
          pointer-events: none !important;
        }

        /* Block elements positioned off-screen but still clickable */
        *[style*="left: -9999"],
        *[style*="top: -9999"] {
          pointer-events: none !important;
        }
      }

      /* Additional mobile popup protection */
      .popup-overlay,
      .modal-overlay,
      .ad-overlay,
      [class*="popup"],
      [id*="popup"],
      [class*="modal"][class*="ad"],
      [id*="modal"][id*="ad"] {
        display: none !important;
        pointer-events: none !important;
      }
    `;

    document.head.appendChild(style);
  }

  // Block analytics and tracking
  blockAnalytics() {
    // Block Google Analytics
    window.ga = function() { console.log('🚫 Blocked Google Analytics call'); };
    window.gtag = function() { console.log('🚫 Blocked gtag call'); };
    
    // Block Facebook Pixel
    window.fbq = function() { console.log('🚫 Blocked Facebook Pixel call'); };
    
    // Block other common analytics
    window._gaq = { push: function() { console.log('🚫 Blocked _gaq call'); } };    window.dataLayer = window.dataLayer || [];
  }
  // Protect specific iframe from ads (targeted protection)
  protectIframe(iframe) {
    if (!iframe || iframe.hasAdBlockProtection) return;
    
    console.log('🛡️ Applying iframe-specific ad protection...');
    
    // Mark iframe as protected
    iframe.hasAdBlockProtection = true;
    
    // Block iframe navigation to ad domains (without global shouldBlockUrl dependency)
    const blockList = [
      'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
      'popads.net', 'popcash.net', 'propellerads.com', 'outbrain.com', 'taboola.com'
    ];
    
    const originalSrc = iframe.src;
    Object.defineProperty(iframe, 'src', {
      set: function(value) {
        if (value && typeof value === 'string') {
          const shouldBlock = blockList.some(domain => 
            value.toLowerCase().includes(domain.toLowerCase())
          );
          if (shouldBlock) {
            console.log('🚫 Blocked iframe redirect to ad:', value);
            return;
          }
        }
        this.setAttribute('src', value);
      },
      get: function() {
        return this.getAttribute('src');
      }
    });
    
    // Prevent iframe from opening popups
    iframe.addEventListener('load', () => {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.open = function() {
            console.log('🚫 Blocked popup from iframe');
            return null;
          };
        }
      } catch (err) {
        // Cross-origin restrictions
      }
    });
    
    console.log('🛡️ Iframe protection applied successfully');
  }

  // Scan iframe content for ads (if accessible)
  scanIframeContent(iframe) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      
      if (iframeDoc) {
        // Remove ad elements from iframe
        this.adSelectors.forEach(selector => {
          const elements = iframeDoc.querySelectorAll(selector);
          elements.forEach(el => {
            el.style.display = 'none';
            el.remove();
          });
        });

        // Block scripts in iframe
        const scripts = iframeDoc.querySelectorAll('script');
        scripts.forEach(script => {
          if (script.src && this.shouldBlockUrl(script.src)) {
            script.remove();
            console.log('🚫 Removed ad script from iframe:', script.src);
          }
        });

        console.log('🛡️ Iframe content scanned and cleaned');
      }
    } catch (err) {
      // Cross-origin restrictions, expected
      console.log('ℹ️ Cannot access iframe content (cross-origin)');
    }
  }

  // Clean up method
  destroy() {
    this.isBlocking = false;
    console.log('🛡️ Ad Blocker destroyed');
  }
  // Get blocking status
  getStatus() {
    return {
      isBlocking: this.isBlocking,
      blockedDomains: this.blockedDomains.length,
      adSelectors: this.adSelectors.length
    };
  }

  // Test TMDB connectivity
  testTMDBConnectivity() {
    const testUrls = [
      'https://api.themoviedb.org',
      'https://image.tmdb.org/t/p/w500',
      'https://www.themoviedb.org'
    ];

    testUrls.forEach(url => {
      fetch(url, { method: 'HEAD' })
        .then(() => console.log(`✅ TMDB connectivity test passed: ${url}`))
        .catch(() => console.warn(`⚠️ TMDB connectivity test failed: ${url}`));
    });
  }
}

// Create singleton instance
const adBlocker = new AdBlockerService();

export default adBlocker;
