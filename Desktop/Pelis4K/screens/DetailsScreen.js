import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  StatusBar,
  Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { getVideoUrl } from '../utils/api';
import config from '../config';
import VideoPlayer from '../components/VideoPlayer';
import EmbedVideoPlayer from '../components/EmbedVideoPlayer';

const { width, height } = Dimensions.get('window');

const DetailsScreen = ({ route, navigation }) => {
  const { item, type } = route.params;
  const [loading, setLoading] = useState(false);
  const [tmdbDescription, setTmdbDescription] = useState('');
  const [actors, setActors] = useState([]);
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [showEmbedPlayer, setShowEmbedPlayer] = useState(false);
  const [videoSource, setVideoSource] = useState('');

  // Función para buscar descripción y actores en TMDB en español
  const fetchTMDBData = async () => {
    try {
      if (!config.tmdb.apiKey || !item.title && !item.name) return;

      const title = item.title || item.name;
      const searchType = type === 'movie' ? 'movie' : 'tv';
      
      // Buscar el contenido por título
      const searchResponse = await fetch(
        `${config.tmdb.baseURL}/search/${searchType}?api_key=${config.tmdb.apiKey}&query=${encodeURIComponent(title)}&language=es-ES`
      );
      const searchData = await searchResponse.json();
      
      if (searchData.results && searchData.results.length > 0) {
        const firstResult = searchData.results[0];
        const movieId = firstResult.id;
        
        // Obtener detalles del contenido encontrado
        const detailsResponse = await fetch(
          `${config.tmdb.baseURL}/${searchType}/${movieId}?api_key=${config.tmdb.apiKey}&language=es-ES`
        );
        const detailsData = await detailsResponse.json();
        
        if (detailsData.overview) {
          setTmdbDescription(detailsData.overview);
        }

        // Obtener actores/reparto
        const creditsResponse = await fetch(
          `${config.tmdb.baseURL}/${searchType}/${movieId}/credits?api_key=${config.tmdb.apiKey}`
        );
        const creditsData = await creditsResponse.json();
        
        if (creditsData.cast) {
          // Tomar los primeros 6 actores principales
          setActors(creditsData.cast.slice(0, 6));
        }
      }
    } catch (error) {
      console.error('Error fetching TMDB data:', error);
    }
  };

  // Cargar datos de TMDB al montar el componente
  useEffect(() => {
    fetchTMDBData();
  }, []);

  // Función para obtener el año de lanzamiento
  const getReleaseYear = () => {
    if (item.release_date) return new Date(item.release_date).getFullYear();
    if (item.first_air_date) return new Date(item.first_air_date).getFullYear();
    return '2024';
  };

  // Función para obtener la duración o temporadas
  const getDurationInfo = () => {
    if (type === 'movie') {
      if (item.runtime) {
        return `${item.runtime} min`;
      }
      // Si no hay duración, mostrar algo útil basado en el año
      const year = getReleaseYear();
      if (year >= 2020) {
        return 'Película reciente';
      } else if (year >= 2010) {
        return 'Película moderna';
      } else {
        return 'Película clásica';
      }
    } else {
      const seasons = item.number_of_seasons || 1;
      const episodes = item.number_of_episodes;
      if (episodes && episodes !== 'N/A') {
        return `${seasons} ${seasons === 1 ? 'temporada' : 'temporadas'} • ${episodes} episodios`;
      } else {
        return `${seasons} ${seasons === 1 ? 'temporada' : 'temporadas'}`;
      }
    }
  };

  // Función para obtener géneros
  const getGenres = () => {
    if (item.genres && Array.isArray(item.genres)) {
      return item.genres.slice(0, 3).join(' • ');
    }
    // Si no hay géneros, inferir basado en el tipo
    if (type === 'movie') {
      return 'Película • Entretenimiento';
    } else if (type === 'series') {
      return 'Serie • Drama';
    } else if (type === 'anime') {
      return 'Anime • Animación';
    }
    return 'Entretenimiento';
  };

  // Función para obtener rating
  const getRating = () => {
    if (item.vote_average) {
      return (item.vote_average / 2).toFixed(1);
    }
    return '4.5';
  };

  // Función para obtener descripción por defecto
  const getDefaultDescription = () => {
    const title = item.title || item.name;
    const year = getReleaseYear();
    
    if (type === 'movie') {
      return `${title} es una película ${year >= 2020 ? 'reciente' : year >= 2010 ? 'moderna' : 'clásica'} disponible en nuestra plataforma. Disfruta de esta producción cinematográfica con la mejor calidad de imagen y sonido.`;
    } else if (type === 'series') {
      return `${title} es una serie que podrás disfrutar completamente en nuestra plataforma. Sigue la historia episodio a episodio con una experiencia de streaming de alta calidad.`;
    } else if (type === 'anime') {
      return `${title} es un anime disponible para ver con subtítulos en español. Disfruta de esta animación japonesa con la mejor calidad de video en nuestra plataforma.`;
    }
    return `${title} está disponible en nuestra plataforma con la mejor experiencia de streaming. Disfruta de contenido de alta calidad.`;
  };

  // Función para reproducir trailer - Busca en YouTube y abre el video
  const handleTrailer = async () => {
    try {
      setTrailerLoading(true);
      
      const title = item.title || item.name;
      if (!title) {
        Alert.alert('Error', 'No se puede buscar el trailer sin el título');
        return;
      }

      // Crear búsqueda específica según el tipo de contenido
      let searchTerm = '';
      const year = getReleaseYear();
      
      if (type === 'movie') {
        searchTerm = `${title} ${year} trailer oficial`;
      } else if (type === 'series') {
        searchTerm = `${title} trailer oficial serie`;
      } else if (type === 'anime') {
        searchTerm = `${title} trailer oficial anime`;
      } else {
        searchTerm = `${title} trailer oficial`;
      }

      console.log('Buscando trailer para:', searchTerm);

      // Usar API pública de YouTube Search (sin API key necesaria)
      try {
        const searchQuery = encodeURIComponent(searchTerm);
        
        // Usar servicio público que no requiere autenticación
        const response = await fetch(`https://youtube-search-api.vercel.app/api/search?q=${searchQuery}&maxResults=1`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data && data.items && data.items.length > 0) {
            const videoId = data.items[0].id.videoId || data.items[0].id;
            if (videoId) {
              const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
              console.log('Video encontrado, abriendo:', videoUrl);
              await WebBrowser.openBrowserAsync(videoUrl);
              return;
            }
          }
        }
        
        throw new Error('No se encontró video en la API');
        
      } catch (apiError) {
        console.log('API falló, usando método de búsqueda directa:', apiError);
        
        // Fallback: Abrir YouTube con búsqueda para que el usuario seleccione
        const searchQuery = encodeURIComponent(searchTerm);
        
        // Intentar abrir con la app nativa de YouTube primero
        try {
          const youtubeAppScheme = `youtube://results?search_query=${searchQuery}`;
          await WebBrowser.openBrowserAsync(youtubeAppScheme);
          console.log('Abierto con app de YouTube');
        } catch (appError) {
          // Si no tiene la app, abrir en navegador web
          const webUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
          await WebBrowser.openBrowserAsync(webUrl);
          console.log('Abierto en navegador web');
        }
      }
      
    } catch (error) {
      console.error('Error buscando trailer:', error);
      Alert.alert('Error', 'No se pudo buscar el trailer');
    } finally {
      setTrailerLoading(false);
    }
  };

  // Función para buscar películas de un actor
  const handleActorPress = (actorName) => {
    Alert.alert(
      actorName,
      'Funcionalidad en desarrollo: Buscar todas las películas de este actor en nuestra plataforma.',
      [{ text: 'OK' }]
    );
    // TODO: Implementar navegación a pantalla de filmografía del actor
  };

  // Función para extraer URL real del video desde iframe
  const extractVideoUrlFromIframe = async (iframeUrl) => {
    try {
      console.log('Procesando URL real de pelis4k.online:', iframeUrl);
      
      // Si ya es una URL directa de video, devolverla
      if (iframeUrl.includes('.mp4') || iframeUrl.includes('.m3u8') || iframeUrl.includes('.webm')) {
        console.log('URL directa detectada:', iframeUrl);
        return iframeUrl;
      }
      
      // Manejar Filemoon específicamente (servidor principal de pelis4k.online)
      if (iframeUrl.includes('filemoon.sx') || iframeUrl.includes('filemoon.to')) {
        console.log('Detectado Filemoon - servidor de pelis4k.online:', iframeUrl);
        
        // Intentar abrir Filemoon directamente
        // En producción necesitarías extraer el video real del iframe
        return iframeUrl;
      }
      
      // Otros servidores comunes usados por pelis4k.online
      if (iframeUrl.includes('streamhd.cc') || 
          iframeUrl.includes('doodstream.com') ||
          iframeUrl.includes('uqload.com') ||
          iframeUrl.includes('fembed.com') ||
          iframeUrl.includes('voe.sx') ||
          iframeUrl.includes('streamtape.com') ||
          iframeUrl.includes('mixdrop.co') ||
          iframeUrl.includes('upstream.to')) {
        
        console.log('Detectado servidor conocido de pelis4k.online:', iframeUrl);
        return iframeUrl;
      }
      
      // Si no reconocemos el servidor, usar la URL original
      console.log('Servidor no reconocido, intentando URL original:', iframeUrl);
      return iframeUrl;
      
    } catch (error) {
      console.error('Error procesando URL de video:', error);
      // Solo como último recurso, usar video demo
      return config.demoVideos.movie;
    }
  };

  // Función para reproducir contenido - Abre el reproductor inteligente de embeds
  const handlePlay = async () => {
    try {
      setLoading(true);
      
      console.log('🎬 Iniciando reproducción para:', item.title || item.name);
      console.log('📊 Datos del item:', item);
      
      // Obtener URL del embed desde diferentes propiedades posibles
      let embedUrl = null;
      
      // Estructura de datos de pelis4k.online (real)
      if (item.episodes && Array.isArray(item.episodes) && item.episodes.length > 0) {
        // Para series/anime - tomar primer episodio
        const firstEpisode = item.episodes[0];
        if (firstEpisode.links && Array.isArray(firstEpisode.links) && firstEpisode.links.length > 0) {
          embedUrl = firstEpisode.links[0];
          console.log('🔗 URL desde episodes.links:', embedUrl);
        }
      } else if (item.links && Array.isArray(item.links) && item.links.length > 0) {
        // Para películas - enlaces directos
        embedUrl = item.links[0];
        console.log('🔗 URL desde links:', embedUrl);
      } else if (item.link) {
        // Estructura alternativa
        if (typeof item.link === 'object') {
          embedUrl = item.link['link-espanol'] || 
                    item.link['link-subtitulado'] || 
                    item.link.link || 
                    item.link;
        } else {
          embedUrl = item.link;
        }
        console.log('🔗 URL desde link:', embedUrl);
      } else if (item.iframeUrl && Array.isArray(item.iframeUrl) && item.iframeUrl.length > 0) {
        embedUrl = item.iframeUrl[0];
        console.log('🔗 URL desde iframeUrl:', embedUrl);
      } else if (item.enlaces && Array.isArray(item.enlaces) && item.enlaces.length > 0) {
        embedUrl = item.enlaces[0].url || item.enlaces[0];
        console.log('🔗 URL desde enlaces:', embedUrl);
      } else if (item.servers && Array.isArray(item.servers) && item.servers.length > 0) {
        embedUrl = item.servers[0].url || item.servers[0];
        console.log('🔗 URL desde servers:', embedUrl);
      }
      
      if (embedUrl && !embedUrl.includes('example.com')) {
        console.log('✅ URL válida encontrada:', embedUrl);
        setVideoSource(embedUrl);
        setShowEmbedPlayer(true);
      } else {
        console.log('⚠️ No se encontró URL válida, usando video de demo');
        
        // Si no hay link específico, usar video de demo basado en el tipo
        let demoUrl;
        if (type === 'movie') {
          demoUrl = config.demoVideos.movie;
        } else if (type === 'series') {
          demoUrl = config.demoVideos.series;
        } else if (type === 'anime') {
          demoUrl = config.demoVideos.anime;
        } else {
          demoUrl = config.demoVideos.movie;
        }
        
        setVideoSource(demoUrl);
        setShowEmbedPlayer(true);
      }
    } catch (error) {
      console.error('❌ Error cargando video:', error);
      Alert.alert(
        'Error', 
        'No se pudo cargar el video. Se reproducirá un video de demostración.',
        [
          {
            text: 'OK',
            onPress: () => {
              setVideoSource(config.demoVideos.movie);
              setShowEmbedPlayer(true);
            }
          },
          { text: 'Cancelar', style: 'cancel' }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  // Función para compartir
  const handleShare = async () => {
    try {
      const message = `¡Mira ${item.title || item.name} en Pelis4K!`;
      await Share.share({
        message,
        title: item.title || item.name,
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  // Función para obtener el icono del tipo
  const getTypeIcon = () => {
    const icons = {
      'movie': 'film',
      'series': 'play-circle',
      'anime': 'radio'
    };
    return icons[type] || 'play';
  };

  // Función para obtener el badge del tipo
  const getTypeBadge = () => {
    const badges = {
      'movie': 'HD',
      'series': 'HD',
      'anime': 'SUB'
    };
    return badges[type] || 'HD';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#000" />
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header con imagen de fondo */}
        <View style={styles.headerContainer}>
          {(item.poster_path || item.image) ? (
            <Image 
              source={{ uri: item.poster_path || item.image }}
              style={styles.backgroundImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderBackground}>
              <Ionicons name={getTypeIcon()} size={80} color="rgba(157, 80, 187, 0.3)" />
            </View>
          )}
          
          {/* Gradiente overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)', '#1f032b']}
            style={styles.gradientOverlay}
          />
          
          {/* Botón de retroceso */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          {/* Botón de compartir */}
          <TouchableOpacity 
            style={styles.shareButton}
            onPress={handleShare}
          >
            <Ionicons name="share" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Contenido del header */}
          <View style={styles.headerContent}>
            {/* Poster pequeño */}
            <View style={styles.posterContainer}>
              {(item.poster_path || item.image) ? (
                <Image 
                  source={{ uri: item.poster_path || item.image }}
                  style={styles.posterImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.posterPlaceholder}>
                  <Ionicons name={getTypeIcon()} size={40} color="rgba(157, 80, 187, 0.4)" />
                </View>
              )}
              
              {/* Badge de tipo */}
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{getTypeBadge()}</Text>
              </View>
            </View>

            {/* Información principal */}
            <View style={styles.mainInfo}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title || item.name}
              </Text>
              
              <View style={styles.metaInfo}>
                <Text style={styles.year}>{getReleaseYear()}</Text>
                <View style={styles.dot} />
                <Text style={styles.duration}>{getDurationInfo()}</Text>
              </View>
              
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.rating}>{getRating()}/5</Text>
                <Text style={styles.genres}>{getGenres()}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Botones de acción rediseñados - Estilo minimalista */}
        <View style={styles.actionButtons}>
          {/* Botón de reproducir - Estilo principal limpio */}
          <TouchableOpacity 
            style={[styles.playButton, loading && styles.buttonDisabled]}
            onPress={handlePlay}
            disabled={loading}
            activeOpacity={0.9}
          >
            <Ionicons 
              name={loading ? "hourglass" : "play"} 
              size={24} 
              color="#fff" 
            />
            <Text style={styles.playButtonText}>
              {loading ? 'Cargando...' : 'Reproducir'}
            </Text>
          </TouchableOpacity>
          
          {/* Botones secundarios - Estilo limpio */}
          <View style={styles.secondaryButtonsRow}>
            <TouchableOpacity 
              style={[styles.actionBtn, trailerLoading && styles.disabledBtn]}
              onPress={handleTrailer}
              disabled={trailerLoading}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={trailerLoading ? "hourglass" : "play-outline"} 
                size={22} 
                color={trailerLoading ? "#666" : "#fff"}
              />
              <Text style={[styles.actionBtnText, trailerLoading && styles.disabledBtnText]}>
                {trailerLoading ? 'Buscando...' : 'Trailer'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="heart-outline" size={22} color="#fff" />
              <Text style={styles.actionBtnText}>Mi lista</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={22} color="#fff" />
              <Text style={styles.actionBtnText}>Compartir</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Descripción */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.description}>
            {tmdbDescription || 
             item.overview || 
             getDefaultDescription()}
          </Text>
        </View>

        {/* Sección de Actores */}
        {actors.length > 0 && (
          <View style={styles.actorsContainer}>
            <Text style={styles.sectionTitle}>Reparto</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.actorsScrollView}
            >
              {actors.map((actor, index) => (
                <TouchableOpacity
                  key={actor.id}
                  style={styles.actorCard}
                  onPress={() => handleActorPress(actor.name)}
                  activeOpacity={0.8}
                >
                  {actor.profile_path ? (
                    <Image
                      source={{ 
                        uri: `https://image.tmdb.org/t/p/w200${actor.profile_path}` 
                      }}
                      style={styles.actorImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.actorPlaceholder}>
                      <Ionicons name="person" size={30} color="rgba(157, 80, 187, 0.4)" />
                    </View>
                  )}
                  <Text style={styles.actorName} numberOfLines={2}>
                    {actor.name}
                  </Text>
                  <Text style={styles.actorCharacter} numberOfLines={1}>
                    {actor.character}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Información adicional */}
        <View style={styles.additionalInfo}>
          <Text style={styles.sectionTitle}>Información</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tipo:</Text>
            <Text style={styles.infoValue}>
              {type === 'movie' ? 'Película' : 
               type === 'series' ? 'Serie' : 'Anime'}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Año:</Text>
            <Text style={styles.infoValue}>{getReleaseYear()}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Calidad:</Text>
            <Text style={styles.infoValue}>HD</Text>
          </View>
          
          {item.vote_count && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Votos:</Text>
              <Text style={styles.infoValue}>{item.vote_count.toLocaleString()}</Text>
            </View>
          )}
        </View>

        {/* Espacio adicional al final */}
        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* Reproductor de video profesional */}
      <VideoPlayer
        visible={showVideoPlayer}
        onClose={() => setShowVideoPlayer(false)}
        videoSource={videoSource}
        title={item.title || item.name}
        subtitle={tmdbDescription || item.overview || `${type === 'movie' ? 'Película' : type === 'series' ? 'Serie' : 'Anime'} • ${getReleaseYear()}`}
      />

      {/* Reproductor inteligente de embeds */}
      <EmbedVideoPlayer
        visible={showEmbedPlayer}
        onClose={() => setShowEmbedPlayer(false)}
        videoSource={videoSource}
        title={item.title || item.name}
        subtitle={tmdbDescription || item.overview || `${type === 'movie' ? 'Película' : type === 'series' ? 'Serie' : 'Anime'} • ${getReleaseYear()}`}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f032b',
  },
  
  scrollView: {
    flex: 1,
  },
  
  // Header con imagen
  headerContainer: {
    height: height * 0.6,
    position: 'relative',
  },
  
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  
  placeholderBackground: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(15, 1, 24, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  
  shareButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  
  headerContent: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
  },
  
  posterContainer: {
    position: 'relative',
    marginRight: 16,
  },
  
  posterImage: {
    width: 100,
    height: 150,
    borderRadius: 12,
  },
  
  posterPlaceholder: {
    width: 100,
    height: 150,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 1, 24, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  typeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#9D50BB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  
  typeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  
  mainInfo: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  year: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    marginHorizontal: 8,
  },
  
  duration: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  rating: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '700',
    marginLeft: 4,
    marginRight: 12,
  },
  
  genres: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  
  // Botones de acción - Estilo minimalista
  actionButtons: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  
  // Botón principal de reproducir - Limpio y simple
  playButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  playButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
    letterSpacing: 0.5,
  },
  
  // Fila de botones secundarios
  secondaryButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  
  // Botones de acción individuales - Estilo limpio
  actionBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 80,
  },
  
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  
  disabledBtn: {
    opacity: 0.4,
  },
  
  disabledBtnText: {
    color: '#666',
  },
  
  buttonDisabled: {
    opacity: 0.6,
  },
  
  // Secciones de contenido
  descriptionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 22,
    fontWeight: '400',
  },
  
  additionalInfo: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 80, 187, 0.1)',
  },
  
  infoLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  
  infoValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  
  // Estilos para la sección de actores
  actorsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  
  actorsScrollView: {
    paddingHorizontal: 0,
  },
  
  actorCard: {
    width: 100,
    marginRight: 16,
    alignItems: 'center',
  },
  
  actorImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(15, 1, 24, 0.8)',
    marginBottom: 8,
  },
  
  actorPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(15, 1, 24, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.2)',
  },
  
  actorName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 14,
  },
  
  actorCharacter: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  disabledBtn: {
    opacity: 0.6,
  },
  
  disabledBtnText: {
    color: '#666',
  },
  
  bottomSpace: {
    height: 40,
  },
});

export default DetailsScreen;
