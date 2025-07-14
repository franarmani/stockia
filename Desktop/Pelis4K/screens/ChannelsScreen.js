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
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { fetchChannels } from '../utils/api';
import ContentCard from '../components/ContentCard';

const ChannelsScreen = ({ navigation }) => {
  const [channels, setChannels] = useState([]);
  const [filteredChannels, setFilteredChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      setLoading(true);
      const data = await fetchChannels();
      // Invertir el orden para mostrar lo más reciente primero
      const reversedData = [...data].reverse();
      setChannels(reversedData);
      setFilteredChannels(reversedData);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los canales');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChannels();
    setRefreshing(false);
  };

  const handleSearch = (text) => {
    setSearchText(text);
    if (text.trim() === '') {
      setFilteredChannels(channels);
    } else {
      const filtered = channels.filter(channel => 
        (channel.name && channel.name.toLowerCase().includes(text.toLowerCase())) ||
        (channel.title && channel.title.toLowerCase().includes(text.toLowerCase())) ||
        (channel.categoria && channel.categoria.toLowerCase().includes(text.toLowerCase())) ||
        (channel.pais && channel.pais.toLowerCase().includes(text.toLowerCase()))
      );
      setFilteredChannels(filtered);
    }
  };

  const clearSearch = () => {
    setSearchText('');
    setFilteredChannels(channels);
    setShowSearch(false);
  };

  const handleChannelPress = (channel) => {
    // Verificar que el canal tenga URLs disponibles
    if (channel.iframeUrl && channel.iframeUrl.length > 0) {
      navigation.navigate('TVPlayer', { channel });
    } else {
      Alert.alert('Error', 'No se encontró el enlace del canal');
    }
  };

  const renderChannel = ({ item }) => (
    <ContentCard item={item} onPress={handleChannelPress} />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor="#1f032b" />
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Canales TV</Text>
            <TouchableOpacity 
              style={[styles.searchButton, styles.searchButtonDisabled]}
              disabled={true}
            >
              <Ionicons name="search" size={24} color="rgba(157, 80, 187, 0.3)" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#9D50BB" />
          <Text style={styles.loadingText}>Cargando canales...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#1f032b" />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Canales TV</Text>
          <TouchableOpacity 
            style={styles.searchButton}
            onPress={() => setShowSearch(!showSearch)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={showSearch ? "close" : "search"} 
              size={24} 
              color="#9D50BB" 
            />
          </TouchableOpacity>
        </View>
        
        {showSearch && (
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="rgba(157, 80, 187, 0.6)" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar canales..."
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={searchText}
                onChangeText={handleSearch}
                autoFocus={true}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color="rgba(157, 80, 187, 0.6)" />
                </TouchableOpacity>
              )}
            </View>
            {searchText.length > 0 && (
              <Text style={styles.resultsText}>
                {filteredChannels.length} canal{filteredChannels.length !== 1 ? 'es' : ''} encontrado{filteredChannels.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
        )}
      </View>
      <FlatList
        data={filteredChannels}
        renderItem={renderChannel}
        keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
        numColumns={3}
        ItemSeparatorComponent={() => <View style={styles.separator} />} // Espaciado entre filas
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        key={`channels-flatlist-3`}
        ListEmptyComponent={() => (
          searchText.length > 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search" size={48} color="rgba(157, 80, 187, 0.5)" />
              <Text style={styles.emptyText}>No se encontraron canales</Text>
              <Text style={styles.emptySubtext}>Intenta con otro término de búsqueda</Text>
            </View>
          ) : null
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f032b',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#1f032b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 80, 187, 0.2)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'left',
    textShadowColor: 'rgba(157, 80, 187, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(157, 80, 187, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.3)',
  },
  searchButtonDisabled: {
    backgroundColor: 'rgba(157, 80, 187, 0.05)',
    borderColor: 'rgba(157, 80, 187, 0.1)',
  },
  searchContainer: {
    marginTop: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.2)',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  resultsText: {
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(157, 80, 187, 0.8)',
    fontWeight: '500',
    textAlign: 'center',
  },
  listContainer: {
    padding: 12, // Aumentado el padding para los canales
    paddingBottom: 30, // Más espacio en la parte inferior
  },
  separator: {
    height: 8, // Separación entre filas para canales
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1f032b',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#9D50BB',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
});

export default ChannelsScreen;
