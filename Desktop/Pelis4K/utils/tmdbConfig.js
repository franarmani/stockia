// Configuración de la API de TMDB
// Para obtener tu API key, visita: https://www.themoviedb.org/settings/api

export const TMDB_CONFIG = {
  API_KEY: '', // Agrega tu API key aquí
  BASE_URL: 'https://api.themoviedb.org/3',
  IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/w500',
  BACKDROP_BASE_URL: 'https://image.tmdb.org/t/p/w1280',
};

// Función para verificar si la API key está configurada
export const isTMDBConfigured = () => {
  return TMDB_CONFIG.API_KEY && TMDB_CONFIG.API_KEY.length > 0;
};

// Función para construir URLs de imágenes de TMDB
export const getTMDBImageUrl = (path, size = 'w500') => {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

// Instrucciones para obtener la API key:
// 1. Ve a https://www.themoviedb.org/
// 2. Crea una cuenta o inicia sesión
// 3. Ve a tu perfil -> Configuración -> API
// 4. Solicita una API key
// 5. Copia la API key y pégala arriba en API_KEY
