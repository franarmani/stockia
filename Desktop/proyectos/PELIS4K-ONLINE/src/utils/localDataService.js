// Servicio centralizado para cargar datos locales con manejo de errores
import React from 'react';

let cachedData = null;
let loadingPromise = null;

// Función para detectar si estamos en móvil
const isMobile = () => {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Función para manejar diferentes estrategias de fetch
const tryFetch = async (url, options = {}) => {
  const strategies = [
    // Estrategia 1: Fetch normal con headers completos y cache-busting
    () => fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      cache: 'no-store',
      ...options
    }),
    
    // Estrategia 2: Fetch simple sin headers extras y con cache-busting
    () => fetch(url, {
      method: 'GET',
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache'
      },
      ...options
    }),
    
    // Estrategia 3: Fetch básico (para móviles con problemas)
    () => fetch(url, {
      cache: 'no-store'
    }),
    
    // Estrategia 4: Fetch con timeout corto
    () => Promise.race([
      fetch(url, { 
        ...options, 
        cache: 'no-store',
        signal: AbortSignal.timeout(5000) 
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
    ])
  ];

  let lastError;
  
  for (let i = 0; i < strategies.length; i++) {
    try {
      console.log(`🔄 Intentando estrategia ${i + 1} para ${url}`);
      const response = await strategies[i]();
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log(`✅ Estrategia ${i + 1} exitosa para ${url}`);
      return response;
    } catch (error) {
      console.warn(`❌ Estrategia ${i + 1} falló:`, error.message);
      lastError = error;
    }
  }
  
  console.error('❌ Todas las estrategias fallaron para', url);
  throw lastError;
};

// Función para cargar datos locales con cache-busting
export const loadLocalData = async () => {
  try {
    // Agregar timestamp para evitar caché del navegador
    const timestamp = new Date().getTime();
    const url = `/data.json?_t=${timestamp}`;
    
    console.log('🔄 Cargando datos locales desde:', url);
    
    const response = await tryFetch(url, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    const data = await response.json();
    console.log('✅ Datos locales cargados exitosamente');
    
    return data;
  } catch (error) {
    console.error('❌ Error cargando datos locales:', error);
    throw error;
  }
};

// Función para cargar datos de canales con cache-busting
export const loadChannelData = async () => {
  try {
    const timestamp = new Date().getTime();
    const url = `/channelData.json?_t=${timestamp}`;
    
    console.log('🔄 Cargando datos de canales desde:', url);
    
    const response = await tryFetch(url);
    const data = await response.json();
    
    console.log('✅ Datos de canales cargados exitosamente');
    return data.channels || [];
  } catch (error) {
    console.error('❌ Error cargando datos de canales:', error);
    throw error;
  }
}

// Función para limpiar caché (útil para desarrollo)
export const clearLocalDataCache = () => {
  cachedData = null;
  loadingPromise = null;
};

// Hook personalizado para usar en componentes React
export const useLocalData = () => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    
    loadLocalData()
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
        // Aún así proporcionar datos vacíos
        setData({ movies: [], series: [] });
      });
  }, []);

  return { data, loading, error };
};
