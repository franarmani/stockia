import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import ContentCard from '../components/ContentCard';
import { 
  fetchMovies, 
  fetchSeries, 
  fetchAnime, 
  fetchChannels 
} from '../utils/api';

const { width } = Dimensions.get('window');

const SearchScreen = ({ navigation }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState({
    movies: [],
    series: [],
    anime: [],
    channels: [],
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState([
    'Batman', 'Avengers', 'Naruto', 'Breaking Bad', 'Game of Thrones'
  ]);

  const performSearch = async (term) => {
    if (!term.trim()) return;
    
    setLoading(true);
    setHasSearched(true);
    
    try {
      // Fetch all data
      const [moviesData, seriesData, animeData, channelsData] = await Promise.all([
        fetchMovies(),
        fetchSeries(),
        fetchAnime(),
        fetchChannels()
      ]);

      // Filter results based on search term
      const searchLower = term.toLowerCase().trim();
      
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

    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchTerm.trim()) {
      performSearch(searchTerm);
    }
  };

  const handleRecentSearch = (term) => {
    setSearchTerm(term);
    performSearch(term);
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
    if (!item || (!item.title && !item.name)) {
      return null;
    }

    return (
      <ContentCard item={item} onPress={() => console.log('Item pressed:', item)} />
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

  const RecentSearchItem = ({ term }) => (
    <TouchableOpacity
      style={styles.recentSearchItem}
      onPress={() => handleRecentSearch(term)}
    >
      <Ionicons name="time-outline" size={16} color="#9D50BB" />
      <Text style={styles.recentSearchText}>{term}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1f032b" barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.mainHeader}>
        <Text style={styles.mainHeaderTitle}>Búsqueda</Text>
      </View>
      
      {/* Header con búsqueda */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#9D50BB" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar películas, series, anime..."
              placeholderTextColor="#666"
              value={searchTerm}
              onChangeText={setSearchTerm}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={() => setSearchTerm('')}
              >
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenido */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!hasSearched ? (
          // Estado inicial - búsquedas recientes
          <View style={styles.initialState}>
            <View style={styles.searchIconContainer}>
              <Ionicons name="search-outline" size={64} color="#9D50BB" />
            </View>
            <Text style={styles.initialTitle}>Descubre contenido increíble</Text>
            <Text style={styles.initialSubtitle}>
              Busca entre miles de películas, series, anime y canales
            </Text>
            
            <View style={styles.recentSearchesContainer}>
              <Text style={styles.recentSearchesTitle}>Búsquedas populares</Text>
              {recentSearches.map((term, index) => (
                <RecentSearchItem key={index} term={term} />
              ))}
            </View>
          </View>
        ) : (
          // Resultados de búsqueda
          <View style={styles.resultsContainer}>
            {/* Información de resultados */}
            <View style={styles.searchInfo}>
              <Text style={styles.searchTerm}>"{searchTerm}"</Text>
              <Text style={styles.resultsCount}>
                {getTotalResults()} resultado{getTotalResults() !== 1 ? 's' : ''} encontrado{getTotalResults() !== 1 ? 's' : ''}
              </Text>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#9D50BB" />
                <Text style={styles.loadingText}>Buscando...</Text>
              </View>
            ) : (
              <>
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

                {/* Resultados */}
                {getFilteredResults().length > 0 ? (
                  <FlatList
                    data={getFilteredResults()}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => `${item.id || index}`}
                    numColumns={3}
                    contentContainerStyle={styles.resultsGrid}
                    showsVerticalScrollIndicator={false}
                    key={`search-results-${activeTab}`}
                    scrollEnabled={false}
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
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f032b',
  },
  mainHeader: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#1f032b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 80, 187, 0.2)',
  },
  mainHeaderTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'left',
    textShadowColor: 'rgba(157, 80, 187, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1f032b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a0438',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.3)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  searchButton: {
    backgroundColor: '#9D50BB',
    borderRadius: 12,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  content: {
    flex: 1,
  },
  initialState: {
    padding: 24,
    alignItems: 'center',
  },
  searchIconContainer: {
    marginTop: 40,
    marginBottom: 24,
  },
  initialTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  initialSubtitle: {
    fontSize: 16,
    color: '#9D50BB',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  recentSearchesContainer: {
    width: '100%',
    marginTop: 20,
  },
  recentSearchesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a0438',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.2)',
  },
  recentSearchText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
  },
  resultsContainer: {
    flex: 1,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
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
  resultsGrid: {
    padding: 8,
    paddingBottom: 20,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
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

export default SearchScreen;
