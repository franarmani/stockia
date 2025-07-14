import React, { useState, useEffect } from 'react';
import { 
  View, 
  FlatList, 
  StyleSheet, 
  Alert, 
  RefreshControl,
  Text,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { fetchSeries } from '../utils/api';
import ContentCard from '../components/ContentCard';
import GenreSlider from '../components/GenreSlider';
import ChromecastModal from '../components/RealChromecastModal';

const { width } = Dimensions.get('window');

const SeriesScreen = ({ navigation }) => {
  const [series, setSeries] = useState([]);
  const [filteredSeries, setFilteredSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' o 'list'
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [showChromecastModal, setShowChromecastModal] = useState(false);
  const [selectedCastItem, setSelectedCastItem] = useState(null);
  const [castVideoUrl, setCastVideoUrl] = useState('');
  const [loadingCast, setLoadingCast] = useState(false);

  useEffect(() => {
    loadSeries();
  }, []);

  useEffect(() => {
    filterSeries();
  }, [searchQuery, series, selectedGenre]);

  const filterSeries = () => {
    let filtered = series;

    // Filtrar por género si no es 'all'
    if (selectedGenre !== 'all') {
      filtered = filtered.filter(serie => {
        const genres = (serie.genres || []).map(g => g.toLowerCase());
        const genreMap = {
          'action': ['acción', 'action'],
          'adventure': ['aventura', 'adventure'],
          'animation': ['animación', 'animation'],
          'comedy': ['comedia', 'comedy'],
          'crime': ['crimen', 'crime'],
          'documentary': ['documental', 'documentary'],
          'drama': ['drama'],
          'family': ['familiar', 'family'],
          'fantasy': ['fantasía', 'fantasy'],
          'history': ['historia', 'history'],
          'horror': ['terror', 'horror'],
          'music': ['musical', 'music'],
          'mystery': ['misterio', 'mystery'],
          'romance': ['romance'],
          'science-fiction': ['ciencia ficción', 'sci-fi', 'science fiction'],
          'thriller': ['thriller'],
          'war': ['guerra', 'war'],
          'western': ['western']
        };
        
        const targetGenres = genreMap[selectedGenre] || [selectedGenre];
        return targetGenres.some(target => 
          genres.some(genre => genre.includes(target))
        );
      });
    }

    // Filtrar por búsqueda si hay query
    if (searchQuery.trim()) {
      filtered = filtered.filter(serie => {
        const title = (serie.title || serie.name || '').toLowerCase();
        const genres = (serie.genres || []).join(' ').toLowerCase();
        const search = searchQuery.toLowerCase();
        
        return title.includes(search) || genres.includes(search);
      });
    }
    
    setFilteredSeries(filtered);
  };

  const loadSeries = async () => {
    try {
      setLoading(true);
      const data = await fetchSeries();
      // Invertir el orden para mostrar lo más reciente primero
      const reversedData = [...data].reverse();
      setSeries(reversedData);
      setFilteredSeries(reversedData);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar las series');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSeries();
    setRefreshing(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchFocused(false);
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'grid' ? 'list' : 'grid');
  };

  const handleGenreSelect = (genreId) => {
    setSelectedGenre(genreId);
  };

  const handleSeriesPress = (serie) => {
    // Navegar a la pantalla de detalles
    navigation.navigate('Details', {
      item: serie,
      type: 'series'
    });
  };

  // Función para manejar transmisión a Chromecast
  const handleCast = async (item) => {
    try {
      setLoadingCast(true);
      setSelectedCastItem(item);
      
      console.log('📺 Preparando para transmitir serie:', item.title || item.name);
      
      // Obtener URL del primer episodio para casting
      let videoUrl = '';
      
      if (item.episodes && Array.isArray(item.episodes) && item.episodes.length > 0) {
        const firstEpisode = item.episodes[0];
        if (firstEpisode.links && Array.isArray(firstEpisode.links) && firstEpisode.links.length > 0) {
          videoUrl = firstEpisode.links[0];
        }
      } else if (item.links && Array.isArray(item.links) && item.links.length > 0) {
        videoUrl = item.links[0];
      }
      
      if (!videoUrl) {
        // Si no hay URL específica, usar demo
        videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';
      }
      
      setCastVideoUrl(videoUrl);
      setShowChromecastModal(true);
      
    } catch (error) {
      console.error('Error preparando casting:', error);
      Alert.alert('Error', 'No se pudo preparar la transmisión');
    } finally {
      setLoadingCast(false);
    }
  };

  const renderSeries = ({ item }) => (
    <ContentCard 
      item={item} 
      onPress={handleSeriesPress}
      onCast={handleCast}
      type="series" 
      viewMode={viewMode} 
    />
  );

  const renderSearchAndGenres = () => (
    <View>
      <View style={styles.searchSection}>
        <View style={[styles.searchContainer, searchFocused && styles.searchContainerFocused]}>
          <Ionicons name="search" size={20} color={searchFocused ? "#9D50BB" : "rgba(255, 255, 255, 0.6)"} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar series..."
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="rgba(255, 255, 255, 0.6)" />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.resultsInfo}>
          <Text style={styles.resultsText}>
            {searchQuery ? `${filteredSeries.length} resultados` : `${series.length} series disponibles`}
          </Text>
        </View>
      </View>
      
      <GenreSlider
        onGenreSelect={handleGenreSelect}
        selectedGenre={selectedGenre}
      />
    </View>
  );

  const renderEmptySearch = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search" size={64} color="rgba(157, 80, 187, 0.3)" />
      <Text style={styles.emptyTitle}>No se encontraron series</Text>
      <Text style={styles.emptySubtitle}>
        Intenta con otros términos de búsqueda
      </Text>
      <TouchableOpacity style={styles.clearSearchButton} onPress={clearSearch}>
        <Text style={styles.clearSearchText}>Limpiar búsqueda</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#1f032b" />
      <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.titleContainer}>
              <Ionicons name="play-circle" size={28} color="#9D50BB" />
              <Text style={styles.headerTitle}>Series</Text>
            </View>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>HD</Text>
            </View>
          </View>
        </View>
        <View style={styles.centered}>
          <View style={styles.loadingSpinner}>
            <ActivityIndicator size="large" color="#9D50BB" />
          </View>
          <Text style={styles.loadingTitle}>Cargando series</Text>
          <Text style={styles.loadingSubtitle}>Preparando contenido...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#000" />
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.titleContainer}>
            <Ionicons name="play-circle" size={28} color="#9D50BB" />
            <Text style={styles.headerTitle}>Series</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>HD</Text>
          </View>
        </View>
      </View>
      
      <FlatList
        data={filteredSeries}
        renderItem={renderSeries}
        keyExtractor={(item) => item.id.toString()}
        numColumns={viewMode === 'grid' ? 3 : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.row : null}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={renderSearchAndGenres}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#9D50BB']}
            tintColor="#9D50BB"
          />
        }
        contentContainerStyle={[
          styles.listContainer,
          filteredSeries.length === 0 && styles.emptyListContainer
        ]}
        ListEmptyComponent={searchQuery ? renderEmptySearch : null}
        key={`series-flatlist-${viewMode}`}
        showsVerticalScrollIndicator={false}
      />
      
      {/* Modal de Chromecast */}
      <ChromecastModal
        visible={showChromecastModal}
        onClose={() => {
          setShowChromecastModal(false);
          setSelectedCastItem(null);
          setCastVideoUrl('');
        }}
        item={selectedCastItem}
        videoUrl={castVideoUrl}
        onStartCasting={(castData) => {
          console.log('✅ Iniciada transmisión de serie:', castData);
          setTimeout(() => {
            setShowChromecastModal(false);
          }, 2000);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f032b',
  },
  
  // Header Profesional
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'rgba(31, 3, 43, 0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 80, 187, 0.15)',
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginLeft: 12,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(157, 80, 187, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerBadge: {
    backgroundColor: 'rgba(157, 80, 187, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9D50BB',
  },
  headerBadgeText: {
    color: '#9D50BB',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Sección de Búsqueda
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(26, 2, 37, 0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 80, 187, 0.08)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(157, 80, 187, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.1)',
    marginBottom: 12,
  },
  searchContainerFocused: {
    borderColor: '#9D50BB',
    backgroundColor: 'rgba(157, 80, 187, 0.1)',
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
  },
  resultsInfo: {
    flexDirection: 'row',
    justifyContent: 'flex-start', // Cambiado de space-between a flex-start
    alignItems: 'center',
  },
  resultsText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  viewToggle: {
    backgroundColor: 'rgba(157, 80, 187, 0.1)',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.3)',
  },

  // Lista y Cards
  listContainer: {
    paddingBottom: 30, // Más espacio en la parte inferior
  },
  row: {
    justifyContent: 'space-evenly', // Distribución más equilibrada para 3 columnas
  },
  separator: {
    height: 8, // Separación entre filas
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },

  // Loading mejorado
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1f032b',
    paddingHorizontal: 20,
  },
  loadingSpinner: {
    marginBottom: 24,
  },
  loadingTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  loadingSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  clearSearchButton: {
    backgroundColor: '#9D50BB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  clearSearchText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default SeriesScreen;
