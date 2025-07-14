import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ContentCard from '../components/ContentCard';
import { 
  fetchMovies, 
  fetchSeries, 
  fetchAnime, 
  fetchChannels 
} from '../utils/api';

const SearchResults = ({ route, navigation }) => {
  const { searchTerm } = route.params;
  const [results, setResults] = useState({
    movies: [],
    series: [],
    anime: [],
    channels: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    performSearch();
  }, [searchTerm]);

  const performSearch = async () => {
    setLoading(true);
    try {
      // Fetch all data
      const [moviesData, seriesData, animeData, channelsData] = await Promise.all([
        fetchMovies(),
        fetchSeries(),
        fetchAnime(),
        fetchChannels()
      ]);

      // Filter results based on search term
      const searchLower = searchTerm.toLowerCase().trim();
      
      const filteredMovies = moviesData.filter(item => 
        item && (item.title || item.name) && (
          (item.title || item.name || '').toLowerCase().includes(searchLower) ||
          (item.overview || item.description || '').toLowerCase().includes(searchLower) ||
          (item.genres || []).some(genre => genre.toLowerCase().includes(searchLower))
        )
      );

      const filteredSeries = seriesData.filter(item => 
        item && (item.title || item.name) && (
          (item.title || item.name || '').toLowerCase().includes(searchLower) ||
          (item.overview || item.description || '').toLowerCase().includes(searchLower) ||
          (item.genres || []).some(genre => genre.toLowerCase().includes(searchLower))
        )
      );

      const filteredAnime = animeData.filter(item => 
        item && (item.title || item.name) && (
          (item.title || item.name || '').toLowerCase().includes(searchLower) ||
          (item.overview || item.description || '').toLowerCase().includes(searchLower) ||
          (item.genres || []).some(genre => genre.toLowerCase().includes(searchLower))
        )
      );

      const filteredChannels = channelsData.filter(item => 
        item && (item.title || item.name) && (
          (item.title || item.name || '').toLowerCase().includes(searchLower) ||
          (item.overview || item.description || '').toLowerCase().includes(searchLower) ||
          (item.categoria || '').toLowerCase().includes(searchLower)
        )
      );

      setResults({
        movies: filteredMovies,
        series: filteredSeries,
        anime: filteredAnime,
        channels: filteredChannels,
      });

      // Debug: mostrar información de los resultados
      console.log('Search results:', {
        movies: filteredMovies.length,
        series: filteredSeries.length,
        anime: filteredAnime.length,
        channels: filteredChannels.length,
        total: filteredMovies.length + filteredSeries.length + filteredAnime.length + filteredChannels.length
      });

      // Debug: mostrar una muestra de los datos
      if (filteredMovies.length > 0) {
        console.log('Sample movie:', filteredMovies[0]);
      }

    } catch (error) {
      console.error('Error searching:', error);
      Alert.alert('Error', 'Hubo un problema al buscar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleItemPress = (item) => {
    Alert.alert(
      'Reproducir',
      `¿Quieres reproducir "${item.title || item.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Reproducir', 
          onPress: () => {
            // Aquí puedes agregar la lógica de reproducción
            console.log('Reproducir:', item);
          }
        }
      ]
    );
  };

  const getTotalResults = () => {
    return results.movies.length + results.series.length + results.anime.length + results.channels.length;
  };

  const getFilteredResults = () => {
    switch (activeTab) {
      case 'movies':
        return results.movies;
      case 'series':
        return results.series;
      case 'anime':
        return results.anime;
      case 'channels':
        return results.channels;
      default:
        return [
          ...results.movies,
          ...results.series,
          ...results.anime,
          ...results.channels
        ];
    }
  };

  const renderItem = ({ item }) => {
    // Debug: verificar si el item tiene datos básicos
    if (!item || (!item.title && !item.name)) {
      console.warn('Item without title/name:', item);
      return null; // No renderizar items vacíos
    }

    return (
      <ContentCard item={item} onPress={handleItemPress} />
    );
  };

  const TabButton = ({ title, tabKey, count }) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        activeTab === tabKey && styles.activeTabButton
      ]}
      onPress={() => setActiveTab(tabKey)}
    >
      <Text style={[
        styles.tabButtonText,
        activeTab === tabKey && styles.activeTabButtonText
      ]}>
        {title} ({count})
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Buscando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Resultados de búsqueda</Text>
      </View>

      {/* Search term and results count */}
      <View style={styles.searchInfo}>
        <Text style={styles.searchTerm}>"{searchTerm}"</Text>
        <Text style={styles.resultsCount}>
          {getTotalResults()} resultado{getTotalResults() !== 1 ? 's' : ''} encontrado{getTotalResults() !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          <TabButton title="Todos" tabKey="all" count={getTotalResults()} />
          <TabButton title="Películas" tabKey="movies" count={results.movies.length} />
          <TabButton title="Series" tabKey="series" count={results.series.length} />
          <TabButton title="Anime" tabKey="anime" count={results.anime.length} />
          <TabButton title="Canales" tabKey="channels" count={results.channels.length} />
        </ScrollView>
      </View>

      {/* Results */}
      {getFilteredResults().length > 0 ? (
        <FlatList
          data={getFilteredResults()}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.id || index}`}
          numColumns={3}
          contentContainerStyle={styles.resultsContainer}
          showsVerticalScrollIndicator={false}
          key={`flatlist-${activeTab}`}
        />
      ) : (
        <View style={styles.noResultsContainer}>
          <Ionicons name="search-outline" size={64} color="#5b2670" />
          <Text style={styles.noResultsText}>No se encontraron resultados</Text>
          <Text style={styles.noResultsSubtext}>
            Intenta con otros términos de búsqueda
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f032b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: '#1f032b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchTerm: {
    fontSize: 16,
    color: '#9D50BB',
    fontWeight: '600',
  },
  resultsCount: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 4,
  },
  tabContainer: {
    backgroundColor: '#1f032b',
    paddingVertical: 15,
    marginBottom: 20,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(157, 80, 187, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.5)',
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  activeTabButton: {
    backgroundColor: '#9D50BB',
    borderColor: '#9D50BB',
    elevation: 4,
    shadowOpacity: 0.5,
  },
  tabButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeTabButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  resultsContainer: {
    padding: 8,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1f032b',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  noResultsText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  noResultsSubtext: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default SearchResults;
