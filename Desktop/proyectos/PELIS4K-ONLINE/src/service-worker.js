// Service Worker mejorado para manejar datos offline
const CACHE_NAME = 'pelis4k-cache-v2';
const DATA_CACHE = 'pelis4k-data-cache-v2';
const urlsToCache = [
  '/data.json',
  '/channelData.json'
];

// Instalar service worker
self.addEventListener('install', (event) => {
  console.log('Service Worker instalándose...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME)
        .then((cache) => {
          console.log('Cache principal abierto');
          return cache.addAll(urlsToCache);
        })
        .catch((error) => {
          console.warn('Error al cachear archivos:', error);
        }),
      caches.open(DATA_CACHE)
        .then((cache) => {
          console.log('Cache de datos abierto');
          return cache;
        })
    ])
  );
  self.skipWaiting(); // Activar inmediatamente
});

// Activar service worker y limpiar caches antiguos
self.addEventListener('activate', (event) => {
  console.log('Service Worker activándose...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE) {
            console.log('Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Tomar control inmediatamente
});

// Interceptar peticiones de red
self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones a archivos JSON de datos
  if (event.request.url.includes('data.json') || event.request.url.includes('channelData.json')) {
    console.log('Interceptando petición:', event.request.url);
    
    event.respondWith(
      // Estrategia: Network First con fallback a cache
      fetch(event.request)
        .then((response) => {
          console.log('Respuesta de red exitosa para:', event.request.url);
          // Si la petición es exitosa, actualizar caché
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(DATA_CACHE)
              .then((cache) => {
                cache.put(event.request, responseToCache);
                console.log('Cache actualizado para:', event.request.url);
              })
              .catch((error) => {
                console.warn('Error actualizando cache:', error);
              });
          }
          return response;
        })
        .catch((error) => {
          console.warn('Error en red para:', event.request.url, error);
          // Si falla la red, intentar desde caché
          return caches.match(event.request)
            .then((response) => {
              if (response) {
                console.log('Sirviendo desde cache:', event.request.url);
                return response;
              }
              // Si no hay caché, devolver datos vacíos
              console.log('No hay cache, devolviendo datos vacíos para:', event.request.url);
              const emptyData = event.request.url.includes('channelData.json') 
                ? { channels: [] }
                : { movies: [], series: [], anime: [] };
              
              return new Response(JSON.stringify(emptyData), {
                headers: { 'Content-Type': 'application/json' }
              });
            })
            .catch((cacheError) => {
              console.error('Error accediendo al cache:', cacheError);
              // Última opción: datos vacíos
              const emptyData = event.request.url.includes('channelData.json') 
                ? { channels: [] }
                : { movies: [], series: [], anime: [] };
              
              return new Response(JSON.stringify(emptyData), {
                headers: { 'Content-Type': 'application/json' }
              });
            });
        })
    );
  }
});