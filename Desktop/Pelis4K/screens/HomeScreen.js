import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { 
  fetchChannels, 
  getVideoUrl,
  searchContent,
  getTrendingMovies,
  getRecentMovies,
  getTrendingSeries
} from '../utils/api';
import BannerCarousel from '../components/BannerCarousel';
import HorizontalSlider from '../components/HorizontalSlider';

const HomeScreen = ({ navigation }) => {
  const [searchText, setSearchText] = useState('');
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [recentMovies, setRecentMovies] = useState([]);
  const [trendingSeries, setTrendingSeries] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      setLoading(true);
      const [trendingMoviesData, recentMoviesData, trendingSeriesData, channelsData] = await Promise.all([
        getTrendingMovies(),
        getRecentMovies(),
        getTrendingSeries(),
        fetchChannels(),
      ]);

      // Establecer los datos obtenidos directamente de tu base de datos
      setTrendingMovies(trendingMoviesData);
      setRecentMovies(recentMoviesData);
      setTrendingSeries(trendingSeriesData);
      
      // Limitar canales a los primeros 10 para mejor rendimiento
      setChannels(channelsData.slice(0, 10));
    } catch (error) {
      console.error('Error loading content:', error);
      Alert.alert('Error', 'No se pudo cargar el contenido');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadContent();
    setRefreshing(false);
  };

  const handleContentPress = (item) => {
    const videoUrl = getVideoUrl(item.link);
    if (videoUrl) {
      WebBrowser.openBrowserAsync(videoUrl);
    } else {
      Alert.alert('Error', 'No se encontró el enlace de video');
    }
  };

  const handleSearch = async () => {
    if (searchText.trim()) {
      navigation.navigate('SearchResults', { searchTerm: searchText });
      setSearchText(''); // Clear search after navigation
    }
  };

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchBar}>
        <View style={styles.searchIconContainer}>
          <Ionicons name="search" size={18} color="rgba(255, 255, 255, 0.9)" />
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar películas, series, canales..."
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSearch}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="rgba(255, 255, 255, 0.7)" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
          <Ionicons name="search" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

      if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9D50BB" />
        <Text style={styles.loadingText}>Cargando contenido...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
      <BannerCarousel 
        data={trendingMovies} 
        autoPlay={true}
        interval={5000}
      />
      
      {renderSearchBar()}
      
      <HorizontalSlider
        data={trendingMovies}
        title="Películas en Tendencia"
        onItemPress={handleContentPress}
      />
      
      <HorizontalSlider
        data={recentMovies}
        title="Películas Agregadas Recientemente"
        onItemPress={handleContentPress}
      />
      
      <HorizontalSlider
        data={trendingSeries}
        title="Series en Tendencia"
        onItemPress={handleContentPress}
      />
      
      <HorizontalSlider
        data={channels}
        title="Canales de TV"
        onItemPress={handleContentPress}
        itemWidth={100}
        itemHeight={100}
        showChannelStyle={true}
      />
      </ScrollView>
    </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1f032b', // black3
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14, // Reducido de 16 a 14
    color: '#9D50BB',
  },
  searchContainer: {
    padding: 15,
    backgroundColor: '#1f032b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(91, 38, 112, 0.3)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(64, 15, 83, 0.8)',
    borderRadius: 30,
    paddingHorizontal: 5,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(91, 38, 112, 0.4)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  searchIconContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    paddingVertical: 8,
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  searchButton: {
    backgroundColor: '#9D50BB',
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 5,
    elevation: 3,
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
});

export default HomeScreen;
