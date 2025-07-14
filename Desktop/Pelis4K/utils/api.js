import config from '../config';

const API_BASE_URL = 'https://pelis4k.online';

// Función para obtener la URL completa de imagen TMDB
const getTMDBImageUrl = (path) => {
  return path ? `${config.tmdb.imageBaseURL}${path}` : null;
};

// Función para obtener trending movies desde TMDB
const fetchTMDBTrendingMovies = async () => {
  try {
    if (!config.tmdb.apiKey) {
      console.warn('TMDB API key not configured. Using local trending criteria.');
      return [];
    }
    
    const response = await fetch(`${config.tmdb.baseURL}/trending/movie/week?api_key=${config.tmdb.apiKey}`);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching TMDB trending movies:', error);
    return [];
  }
};

// Función para obtener trending series desde TMDB
const fetchTMDBTrendingSeries = async () => {
  try {
    if (!config.tmdb.apiKey) {
      console.warn('TMDB API key not configured. Using local trending criteria.');
      return [];
    }
    
    const response = await fetch(`${config.tmdb.baseURL}/trending/tv/week?api_key=${config.tmdb.apiKey}`);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching TMDB trending series:', error);
    return [];
  }
};

export const fetchMovies = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/data.json`);
    const data = await response.json();
    return data.movies || [];
  } catch (error) {
    console.error('Error fetching movies:', error);
    return [];
  }
};

export const fetchSeries = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/data.json`);
    const data = await response.json();
    return data.series || [];
  } catch (error) {
    console.error('Error fetching series:', error);
    return [];
  }
};

export const fetchAnime = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/data.json`);
    const data = await response.json();
    return data.anime || [];
  } catch (error) {
    console.error('Error fetching anime:', error);
    return [];
  }
};

export const fetchChannels = async () => {
  try {
    // Intentar diferentes métodos para obtener los datos
    console.log('Fetching channels from channelData.json...');
    
    const response = await fetch('https://pelis4k.online/channelData.json', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Obtener como array buffer primero y luego convertir
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    let text = decoder.decode(buffer);
    
    // Remover BOM y caracteres problemáticos
    text = text.replace(/^\uFEFF/, ''); // BOM UTF-8
    text = text.replace(/^\uFFFE/, ''); // BOM UTF-16 BE 
    text = text.replace(/^\u0000\uFEFF/, ''); // BOM UTF-16 LE
    text = text.replace(/^\u00EF\u00BB\u00BF/, ''); // BOM UTF-8 alternativo
    text = text.trim();
    
    console.log('Text length:', text.length, 'First chars:', text.substring(0, 50));
    
    const data = JSON.parse(text);
    console.log('Parsed data structure:', Object.keys(data));
    
    // Manejar diferentes estructuras de respuesta
    let channelsArray = [];
    
    if (Array.isArray(data)) {
      channelsArray = data;
    } else if (data.channels && Array.isArray(data.channels)) {
      channelsArray = data.channels;
    } else if (data.data && Array.isArray(data.data)) {
      channelsArray = data.data;
    } else {
      console.warn('Unexpected channel data structure:', data);
      return [];
    }
    
    console.log('Channels found:', channelsArray.length);
    
    if (channelsArray.length === 0) {
      console.warn('No channels found in data');
      return [];
    }
    
    // Extraer los canales del array y transformar para compatibilidad con ContentCard
    const channels = channelsArray.map(channel => {
      // Manejar URLs de imágenes - convertir rutas relativas a absolutas
      let imageUrl = channel.image;
      if (imageUrl && imageUrl.startsWith('/')) {
        imageUrl = `https://pelis4k.online${imageUrl}`;
      }
      
      return {
        id: channel.id || '',
        title: channel.name || channel.nombreCanal || '',
        name: channel.name || channel.nombreCanal || '',
        image: imageUrl || 'https://pelis4k.online/canales_imgs/default.jpg',
        poster_path: null, // No usar poster_path para canales para mostrar íconos TV
        categoria: channel.categoria || 'General',
        pais: channel.pais || 'Internacional',
        calidad: channel.calidad || 'HD',
        iframeUrl: channel.iframeUrl || [],
        description: channel.description || `Canal ${channel.categoria || 'General'} de ${channel.pais || 'Internacional'}`,
        isActive: channel.isActive !== false,
        streamId: channel.streamId || channel.id,
        originalStreamId: channel.originalStreamId || channel.id,
        source: channel.source || 'channelData',
        lastUpdate: channel.lastUpdate || new Date().toISOString(),
        // Campos adicionales específicos de canales
        nombreCanal: channel.nombreCanal || channel.name,
        genres: [channel.categoria || 'General'] // Para compatibilidad con ContentCard
      };
    });
    
    // Filtrar solo canales activos
    const activeChannels = channels.filter(channel => channel.isActive);
    console.log('Active channels:', activeChannels.length);
    
    return activeChannels;
  } catch (error) {
    console.error('Error fetching channels:', error);
    
    // Fallback con algunos canales de prueba
    console.log('Returning fallback channels for testing...');
    return [
      {
        id: 'test_espn',
        title: 'ESPN',
        name: 'ESPN',
        categoria: 'Deportes',
        pais: 'Internacional', 
        calidad: 'HD',
        iframeUrl: ['https://example.com/espn'],
        description: 'Canal deportivo ESPN',
        isActive: true,
        poster_path: null,
        image: null,
        genres: ['Deportes']
      },
      {
        id: 'test_cnn',
        title: 'CNN',
        name: 'CNN',
        categoria: 'Noticias',
        pais: 'Estados Unidos',
        calidad: 'HD', 
        iframeUrl: ['https://example.com/cnn'],
        description: 'Canal de noticias CNN',
        isActive: true,
        poster_path: null,
        image: null,
        genres: ['Noticias']
      },
      {
        id: 'test_discovery',
        title: 'Discovery Channel',
        name: 'Discovery Channel',
        categoria: 'Documentales',
        pais: 'Internacional',
        calidad: 'HD',
        iframeUrl: ['https://example.com/discovery'],
        description: 'Canal de documentales Discovery',
        isActive: true,
        poster_path: null,
        image: null,
        genres: ['Documentales']
      }
    ];
  }
};

export const getVideoUrl = (linkData) => {
  if (typeof linkData === 'string') {
    return linkData;
  }
  
  if (linkData && typeof linkData === 'object') {
    return linkData.link || linkData['link-espanol'] || linkData['link-subtitulado'] || '';
  }
  
  return '';
};

// Función para obtener películas trending basado en TMDB y filtradas por tu base de datos
export const getTrendingMovies = async () => {
  try {
    const [tmdbTrending, localMovies] = await Promise.all([
      fetchTMDBTrendingMovies(),
      fetchMovies()
    ]);
    
    if (localMovies.length === 0) return [];
    
    // Si no hay conexión con TMDB, usar criterios locales
    if (tmdbTrending.length === 0) {
      return getTrendingMoviesLocal(localMovies);
    }
    
    // Filtrar películas locales que están en trending en TMDB
    const trendingMovies = [];
    
    for (const tmdbMovie of tmdbTrending) {
      // Buscar la película en tu base de datos
      const localMovie = localMovies.find(movie => {
        // Buscar por ID de TMDB si está disponible
        if (movie.tmdb_id && movie.tmdb_id === tmdbMovie.id) {
          return true;
        }
        
        // Buscar por título (normalizado)
        const localTitle = (movie.title || movie.name || '').toLowerCase().trim();
        const tmdbTitle = (tmdbMovie.title || tmdbMovie.name || '').toLowerCase().trim();
        
        // Buscar coincidencia exacta o muy similar
        if (localTitle === tmdbTitle) {
          return true;
        }
        
        // Buscar coincidencia parcial (para títulos que pueden tener variaciones)
        if (localTitle.includes(tmdbTitle) || tmdbTitle.includes(localTitle)) {
          return true;
        }
        
        return false;
      });
      
      if (localMovie) {
        // Agregar información adicional de TMDB si no está presente
        const enrichedMovie = {
          ...localMovie,
          tmdb_id: tmdbMovie.id,
          tmdb_popularity: tmdbMovie.popularity,
          tmdb_vote_average: tmdbMovie.vote_average,
          backdrop_path: tmdbMovie.backdrop_path,
          poster_path: localMovie.poster_path || localMovie.image || getTMDBImageUrl(tmdbMovie.poster_path),
          overview: localMovie.overview || localMovie.description || localMovie.sinopsis || tmdbMovie.overview,
        };
        
        trendingMovies.push(enrichedMovie);
      }
      
      // Limitar a 10 películas
      if (trendingMovies.length >= 10) break;
    }
    
    // Si no encontramos suficientes películas trending, completar con criterios locales
    if (trendingMovies.length < 10) {
      const localTrending = getTrendingMoviesLocal(localMovies);
      const additionalMovies = localTrending
        .filter(movie => !trendingMovies.find(tm => tm.id === movie.id))
        .slice(0, 10 - trendingMovies.length);
      
      trendingMovies.push(...additionalMovies);
    }
    
    return trendingMovies;
  } catch (error) {
    console.error('Error fetching trending movies:', error);
    // Fallback a criterios locales
    const localMovies = await fetchMovies();
    return getTrendingMoviesLocal(localMovies);
  }
};

// Función para obtener películas recientes basado en el orden en el JSON
export const getRecentMovies = async () => {
  try {
    const movies = await fetchMovies();
    
    // Asumir que las películas al final del array son las más recientes
    // Tomar las últimas 10 y revertir para mostrar la más nueva primero
    return movies.slice(-10).reverse();
  } catch (error) {
    console.error('Error fetching recent movies:', error);
    return [];
  }
};

// Función para obtener series trending basado en TMDB y filtradas por tu base de datos
export const getTrendingSeries = async () => {
  try {
    const [tmdbTrending, localSeries] = await Promise.all([
      fetchTMDBTrendingSeries(),
      fetchSeries()
    ]);
    
    if (localSeries.length === 0) return [];
    
    // Si no hay conexión con TMDB, usar criterios locales
    if (tmdbTrending.length === 0) {
      return getTrendingSeriesLocal(localSeries);
    }
    
    // Filtrar series locales que están en trending en TMDB
    const trendingSeries = [];
    
    for (const tmdbSerie of tmdbTrending) {
      // Buscar la serie en tu base de datos
      const localSerie = localSeries.find(serie => {
        // Buscar por ID de TMDB si está disponible
        if (serie.tmdb_id && serie.tmdb_id === tmdbSerie.id) {
          return true;
        }
        
        // Buscar por título (normalizado)
        const localTitle = (serie.title || serie.name || '').toLowerCase().trim();
        const tmdbTitle = (tmdbSerie.title || tmdbSerie.name || '').toLowerCase().trim();
        
        // Buscar coincidencia exacta o muy similar
        if (localTitle === tmdbTitle) {
          return true;
        }
        
        // Buscar coincidencia parcial
        if (localTitle.includes(tmdbTitle) || tmdbTitle.includes(localTitle)) {
          return true;
        }
        
        return false;
      });
      
      if (localSerie) {
        // Agregar información adicional de TMDB si no está presente
        const enrichedSerie = {
          ...localSerie,
          tmdb_id: tmdbSerie.id,
          tmdb_popularity: tmdbSerie.popularity,
          tmdb_vote_average: tmdbSerie.vote_average,
          backdrop_path: tmdbSerie.backdrop_path,
          poster_path: localSerie.poster_path || localSerie.image || getTMDBImageUrl(tmdbSerie.poster_path),
          overview: localSerie.overview || localSerie.description || localSerie.sinopsis || tmdbSerie.overview,
        };
        
        trendingSeries.push(enrichedSerie);
      }
      
      // Limitar a 10 series
      if (trendingSeries.length >= 10) break;
    }
    
    // Si no encontramos suficientes series trending, completar con criterios locales
    if (trendingSeries.length < 10) {
      const localTrending = getTrendingSeriesLocal(localSeries);
      const additionalSeries = localTrending
        .filter(serie => !trendingSeries.find(ts => ts.id === serie.id))
        .slice(0, 10 - trendingSeries.length);
      
      trendingSeries.push(...additionalSeries);
    }
    
    return trendingSeries;
  } catch (error) {
    console.error('Error fetching trending series:', error);
    // Fallback a criterios locales
    const localSeries = await fetchSeries();
    return getTrendingSeriesLocal(localSeries);
  }
};

// Función para obtener contenido trending (simulado - basado en los primeros elementos)
export const getTrendingContent = async (type = 'movies') => {
  try {
    let data = [];
    switch (type) {
      case 'movies':
        data = await getTrendingMovies();
        break;
      case 'series':
        data = await getTrendingSeries();
        break;
      case 'anime':
        data = await fetchAnime();
        break;
      default:
        data = await getTrendingMovies();
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching trending content:', error);
    return [];
  }
};

// Función para obtener contenido reciente (simulado - basado en los últimos elementos)
export const getRecentContent = async (type = 'movies') => {
  try {
    let data = [];
    switch (type) {
      case 'movies':
        data = await getRecentMovies();
        break;
      case 'series':
        data = await fetchSeries();
        // Para series, también tomar las últimas
        data = data.slice(-10).reverse();
        break;
      case 'anime':
        data = await fetchAnime();
        // Para anime, también tomar los últimos
        data = data.slice(-10).reverse();
        break;
      default:
        data = await getRecentMovies();
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching recent content:', error);
    return [];
  }
};

// Función para buscar contenido solo en tu base de datos
export const searchContent = async (query) => {
  try {
    const [movies, series, anime] = await Promise.all([
      fetchMovies(),
      fetchSeries(),
      fetchAnime()
    ]);
    
    const allContent = [...movies, ...series, ...anime];
    const searchQuery = query.toLowerCase();
    
    // Buscar en título, descripción y otros campos relevantes
    const results = allContent.filter(item => {
      const title = (item.title || item.name || '').toLowerCase();
      const description = (item.overview || item.description || item.sinopsis || '').toLowerCase();
      const genres = Array.isArray(item.generos) ? item.generos.join(' ').toLowerCase() : '';
      const category = (item.categoria || '').toLowerCase();
      const country = (item.pais || '').toLowerCase();
      const year = (item.year || item.release_date || '').toString().toLowerCase();
      
      return title.includes(searchQuery) ||
             description.includes(searchQuery) ||
             genres.includes(searchQuery) ||
             category.includes(searchQuery) ||
             country.includes(searchQuery) ||
             year.includes(searchQuery);
    });
    
    // Ordenar los resultados por relevancia (título exact match first)
    return results.sort((a, b) => {
      const aTitle = (a.title || a.name || '').toLowerCase();
      const bTitle = (b.title || b.name || '').toLowerCase();
      
      if (aTitle.includes(searchQuery) && !bTitle.includes(searchQuery)) return -1;
      if (!aTitle.includes(searchQuery) && bTitle.includes(searchQuery)) return 1;
      return 0;
    });
  } catch (error) {
    console.error('Error searching content:', error);
    return [];
  }
};

// Función para verificar si un contenido está disponible en tu base de datos
export const isContentAvailable = async (tmdbId, type = 'movie') => {
  try {
    let data = [];
    switch (type) {
      case 'movie':
        data = await fetchMovies();
        break;
      case 'series':
        data = await fetchSeries();
        break;
      case 'anime':
        data = await fetchAnime();
        break;
      default:
        data = await fetchMovies();
    }
    
    // Buscar por ID de TMDB si está disponible
    return data.find(item => item.tmdb_id === tmdbId || item.id === tmdbId);
  } catch (error) {
    console.error('Error checking content availability:', error);
    return null;
  }
};

// Función para obtener estadísticas del contenido
export const getContentStats = async () => {
  try {
    const [movies, series, anime, channels] = await Promise.all([
      fetchMovies(),
      fetchSeries(),
      fetchAnime(),
      fetchChannels(),
    ]);
    
    return {
      totalMovies: movies.length,
      totalSeries: series.length,
      totalAnime: anime.length,
      totalChannels: channels.length,
      totalContent: movies.length + series.length + anime.length + channels.length
    };
  } catch (error) {
    console.error('Error getting content stats:', error);
    return {
      totalMovies: 0,
      totalSeries: 0,
      totalAnime: 0,
      totalChannels: 0,
      totalContent: 0
    };
  }
};

// Función auxiliar para obtener trending basándose en criterios locales (fallback)
const getTrendingMoviesLocal = (movies) => {
  if (movies.length === 0) return [];
  
  // Filtrar películas que podrían considerarse "trending" basándose en criterios específicos
  const trendingMovies = movies.filter(movie => {
    // Criterio 1: Películas con mejor calidad (4K, 1080p, HD)
    const hasGoodQuality = movie.calidad && 
      (movie.calidad.includes('4K') || 
       movie.calidad.includes('1080p') || 
       movie.calidad.includes('HD') ||
       movie.calidad.includes('BluRay'));
    
    // Criterio 2: Géneros populares
    const hasPopularGenres = movie.generos && Array.isArray(movie.generos) &&
      movie.generos.some(genre => 
        ['Acción', 'Aventura', 'Comedia', 'Drama', 'Thriller', 'Ciencia ficción', 'Terror'].includes(genre)
      );
    
    // Criterio 3: Películas recientes (últimos años)
    const currentYear = new Date().getFullYear();
    const movieYear = movie.year || (movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : 0);
    const isRecent = movieYear >= currentYear - 3; // Últimos 3 años
    
    // Criterio 4: Tiene imagen/poster para mostrar bien en el banner
    const hasImage = movie.poster_path || movie.image;
    
    // Una película está en trending si cumple al menos 2 criterios
    const criteriaCount = [hasGoodQuality, hasPopularGenres, isRecent, hasImage].filter(Boolean).length;
    return criteriaCount >= 2;
  });
  
  // Ordenar por calidad y año (más recientes primero)
  const sortedTrending = trendingMovies.sort((a, b) => {
    // Priorizar 4K, luego 1080p, luego HD
    const qualityOrder = { '4K': 3, '1080p': 2, 'HD': 1 };
    const aQuality = qualityOrder[a.calidad] || 0;
    const bQuality = qualityOrder[b.calidad] || 0;
    
    if (aQuality !== bQuality) {
      return bQuality - aQuality;
    }
    
    // Si tienen la misma calidad, ordenar por año (más recientes primero)
    const aYear = a.year || (a.release_date ? parseInt(a.release_date.substring(0, 4)) : 0);
    const bYear = b.year || (b.release_date ? parseInt(b.release_date.substring(0, 4)) : 0);
    return bYear - aYear;
  });
  
  // Si no hay suficientes películas que cumplan los criterios, 
  // complementar con las primeras películas disponibles
  if (sortedTrending.length < 10) {
    const remainingMovies = movies
      .filter(movie => !sortedTrending.includes(movie))
      .filter(movie => movie.poster_path || movie.image) // Que tengan imagen
      .slice(0, 10 - sortedTrending.length);
    
    return [...sortedTrending, ...remainingMovies].slice(0, 10);
  }
  
  return sortedTrending.slice(0, 10);
};

// Función auxiliar para obtener series trending basándose en criterios locales (fallback)
const getTrendingSeriesLocal = (series) => {
  if (series.length === 0) return [];
  
  // Filtrar series que podrían considerarse "trending"
  const trendingSeries = series.filter(serie => {
    // Criterio 1: Series con mejor calidad
    const hasGoodQuality = serie.calidad && 
      (serie.calidad.includes('4K') || 
       serie.calidad.includes('1080p') || 
       serie.calidad.includes('HD') ||
       serie.calidad.includes('BluRay'));
    
    // Criterio 2: Géneros populares para series
    const hasPopularGenres = serie.generos && Array.isArray(serie.generos) &&
      serie.generos.some(genre => 
        ['Drama', 'Comedia', 'Thriller', 'Acción', 'Misterio', 'Crimen', 'Ciencia ficción'].includes(genre)
      );
    
    // Criterio 3: Series recientes
    const currentYear = new Date().getFullYear();
    const serieYear = serie.year || (serie.release_date ? parseInt(serie.release_date.substring(0, 4)) : 0);
    const isRecent = serieYear >= currentYear - 5; // Últimos 5 años para series (más amplio)
    
    // Criterio 4: Tiene imagen/poster
    const hasImage = serie.poster_path || serie.image;
    
    // Una serie está en trending si cumple al menos 2 criterios
    const criteriaCount = [hasGoodQuality, hasPopularGenres, isRecent, hasImage].filter(Boolean).length;
    return criteriaCount >= 2;
  });
  
  // Ordenar por calidad y año
  const sortedTrending = trendingSeries.sort((a, b) => {
    const qualityOrder = { '4K': 3, '1080p': 2, 'HD': 1 };
    const aQuality = qualityOrder[a.calidad] || 0;
    const bQuality = qualityOrder[b.calidad] || 0;
    
    if (aQuality !== bQuality) {
      return bQuality - aQuality;
    }
    
    const aYear = a.year || (a.release_date ? parseInt(a.release_date.substring(0, 4)) : 0);
    const bYear = b.year || (b.release_date ? parseInt(b.release_date.substring(0, 4)) : 0);
    return bYear - aYear;
  });
  
  // Si no hay suficientes series que cumplan los criterios, complementar
  if (sortedTrending.length < 10) {
    const remainingSeries = series
      .filter(serie => !sortedTrending.includes(serie))
      .filter(serie => serie.poster_path || serie.image)
      .slice(0, 10 - sortedTrending.length);
    
    return [...sortedTrending, ...remainingSeries].slice(0, 10);
  }
  
  return sortedTrending.slice(0, 10);
};
