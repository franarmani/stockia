// Enhanced Service Worker for Ad Blocking
const CACHE_NAME = 'pelis4k-adblocker-v3';

// Whitelist for essential domains (never block these)
const WHITELIST_DOMAINS = [
  // TMDB and essential services
  'api.themoviedb.org', 'image.tmdb.org', 'www.themoviedb.org', 'tmdb.org',
  'themoviedb.org', 'images.tmdb.org',
  'googleapis.com', 'gstatic.com', 'cloudflare.com', 'jsdelivr.net', 'unpkg.com',
  'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com',
  
  // Streaming and player domains (NEVER BLOCK THESE)
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
  'supervideo.tv',  'streamlare.com',
  'mixdrop.co',
  'mixdrop.to',
  'mixdrop.my', 
  'mixdrop.sx',
  'mp4upload.com',
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
  'sbfull.com',
  'javstream.com',
  'steamcloud.tk',
  'fembed.com',
  'embedsito.com',
  'fembedplus.com',
  'diasfem.com',
  'femax20.com',
  'dutrag.com',
  'suzihaza.com',
  'javplaya.com',
  'sbnmp.bar',
  'sbthe.com',
  'sbrulz.com',
  'sbplay2.com',
  'eplayvid.net',
  'sblanh.com',
  'stream196tp.com'
];

// Comprehensive blocked domains list
const BLOCKED_DOMAINS = [
  // Ad networks
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'amazon-adsystem.com', 'media.net', 'outbrain.com', 'taboola.com',
  'criteo.com', 'adskeeper.co.uk', 'mgid.com', 'propellerads.com',
  'popads.net', 'popcash.net', 'adnxs.com', 'advertising.com',
  
  // Video ads
  'imasdk.googleapis.com', 'pubads.g.doubleclick.net',
  'securepubads.g.doubleclick.net', 'tpc.googlesyndication.com',
  
  // Analytics and tracking
  'google-analytics.com', 'googletagmanager.com', 'facebook.com/tr',
  'connect.facebook.net', 'hotjar.com', 'mixpanel.com', 'segment.com',
  
  // Pop-up domains
  'clicksor.com', 'infolinks.com', 'chitika.com', 'bidvertiser.com',
  'linkbucks.com', 'adf.ly', 'short.st', 'ouo.io', 'bc.vc'
];

// Blocked URL patterns
const BLOCKED_PATTERNS = [
  /\/ads?[\/\?]/i,
  /\/advertising[\/\?]/i,
  /\/popup[\/\?]/i,
  /\/banner[\/\?]/i,
  /\/tracking[\/\?]/i,
  /analytics/i,
  /doubleclick/i,
  /adsystem/i,
  /adsense/i,
  // Mobile-specific popup patterns
  /mobile[_-]?popup/i,
  /mobile[_-]?ad/i,
  /touch[_-]?ad/i,
  /redirect[_-]?mobile/i,
  /pop[_-]?mobile/i
];

// Check if URL should be blocked
function shouldBlockRequest(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();
    const fullUrl = url.toLowerCase();    // NEVER block streaming/player domains - highest priority check
    const streamingDomains = [
      'canalesonline.netlify.app', 'maafiaseries.netlify.app', 'pelis4konline.netlify.app', 
      'cinemaplus.netlify.app', 'cineplex.netlify.app', 'streamtape.com', 'streamhub.to', 
      'embedgram.com', 'doodstream.com', 'upstream.to', 'uptostream.com', 'voe.sx', 
      'supervideo.tv', 'streamlare.com', 'mixdrop.co', 'mixdrop.to', 'mixdrop.my', 'mixdrop.sx',
      'mp4upload.com', 'gounlimited.to',
      'jetload.net', 'videobin.co', 'userload.co', 'rapidvideo.com', 'clipwatching.com', 
      'powerwatch.pw', 'streamsb.net', 'sbplay.one', 'sbplay.org', 'playersb.com', 
      'tubesb.com', 'sbfull.com', 'javstream.com', 'steamcloud.tk', 'fembed.com', 
      'embedsito.com', 'fembedplus.com', 'diasfem.com', 'femax20.com', 'dutrag.com', 
      'suzihaza.com', 'javplaya.com', 'sbnmp.bar', 'sbthe.com', 'sbrulz.com', 
      'sbplay2.com', 'eplayvid.net', 'sblanh.com', 'stream196tp.com'
    ];
    
    for (const domain of streamingDomains) {
      if (hostname.includes(domain) || hostname === domain) {
        console.log('🎥 SW: Streaming URL allowed:', url);
        return false;
      }
    }

    // Check whitelist - never block whitelisted domains
    for (const domain of WHITELIST_DOMAINS) {
      const domainLower = domain.toLowerCase();
      if (hostname.includes(domainLower) || 
          hostname === domainLower ||
          hostname === `www.${domainLower}` ||
          fullUrl.includes(`//${domainLower}`) ||
          fullUrl.includes(`https://${domainLower}`) ||
          fullUrl.includes(`http://${domainLower}`)) {
        console.log('✅ SW: URL whitelisted:', url);
        return false;
      }
    }

    // Check blocked domains
    for (const domain of BLOCKED_DOMAINS) {
      if (hostname.includes(domain.toLowerCase())) {
        console.log('🚫 SW: URL blocked:', url);
        return true;
      }
    }

    // Check blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(fullUrl)) {
        console.log('🚫 SW: Pattern blocked:', url);
        return true;
      }
    }

    // Block specific ad-related paths
    if (pathname.includes('/ads/') || 
        pathname.includes('/advertising/') ||
        pathname.includes('/popup/') ||
        pathname.includes('/banner/')) {
      console.log('🚫 SW: Path blocked:', url);
      return true;
    }

    return false;
  } catch (e) {
    console.error('SW: Error checking URL:', e);
    return false;
  }
}

// Create blocked response
function createBlockedResponse() {
  return new Response('', {
    status: 204,
    statusText: 'No Content - Blocked by Ad Blocker',
    headers: {
      'Content-Type': 'text/plain',
      'X-Blocked-By': 'PELIS4K-AdBlocker'
    }
  });
}

// Service Worker event listeners
self.addEventListener('install', (event) => {
  console.log('🛡️ Ad Blocker Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('🛡️ Ad Blocker Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Intercept fetch requests
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = request.url;

  // Only process HTTP(S) requests
  if (!url.startsWith('http')) {
    return;
  }

  // Check if request should be blocked
  if (shouldBlockRequest(url)) {
    console.log('🚫 SW Blocked request:', url);
    event.respondWith(createBlockedResponse());
    return;
  }
  // Special handling for streaming/player domains - let them pass through completely
  const hostname = new URL(url).hostname.toLowerCase();  const isStreamingDomain = [
    'canalesonline.netlify.app', 'maafiaseries.netlify.app', 'pelis4konline.netlify.app',
    'cinemaplus.netlify.app', 'cineplex.netlify.app', 'streamtape.com', 'streamhub.to', 
    'embedgram.com', 'doodstream.com', 'upstream.to', 'uptostream.com', 'voe.sx', 
    'supervideo.tv', 'streamlare.com', 'mixdrop.co', 'mixdrop.to', 'mixdrop.my', 'mixdrop.sx',
    'mp4upload.com', 'stream196tp.com'
  ].some(domain => hostname.includes(domain));

  // For streaming domains, pass through without any modification
  if (isStreamingDomain) {
    console.log('🎥 SW: Streaming domain - passing through:', url);
    return; // Let the request proceed normally
  }

  // For iframe requests from non-streaming domains, add security headers
  if (request.destination === 'iframe' || request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone response to modify headers
          const newHeaders = new Headers(response.headers);
          
          // Add security headers only for non-streaming domains
          newHeaders.set('X-Frame-Options', 'SAMEORIGIN');
          newHeaders.set('X-Content-Type-Options', 'nosniff');
          newHeaders.set('Referrer-Policy', 'no-referrer');
          
          // Create new response with security headers
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
          });
        })
        .catch(() => {
          // If fetch fails, return blocked response
          return createBlockedResponse();
        })
    );
    return;
  }

  // For other requests, proceed normally
  event.respondWith(fetch(request));
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_STATUS') {
    event.ports[0].postMessage({
      type: 'STATUS_RESPONSE',
      blockedDomains: BLOCKED_DOMAINS.length,
      blockedPatterns: BLOCKED_PATTERNS.length,
      isActive: true
    });
  }
});
