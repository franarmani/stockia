import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const GenreSlider = ({ onGenreSelect, selectedGenre }) => {
  const genres = [
    { id: 'all', name: 'Todos', icon: 'apps' },
    { id: 'action', name: 'Acción', icon: 'flash' },
    { id: 'adventure', name: 'Aventura', icon: 'compass' },
    { id: 'animation', name: 'Animación', icon: 'color-palette' },
    { id: 'comedy', name: 'Comedia', icon: 'happy' },
    { id: 'crime', name: 'Crimen', icon: 'skull' },
    { id: 'documentary', name: 'Documental', icon: 'library' },
    { id: 'drama', name: 'Drama', icon: 'heart' },
    { id: 'family', name: 'Familiar', icon: 'people' },
    { id: 'fantasy', name: 'Fantasía', icon: 'sparkles' },
    { id: 'history', name: 'Historia', icon: 'time' },
    { id: 'horror', name: 'Terror', icon: 'skull-outline' },
    { id: 'music', name: 'Musical', icon: 'musical-notes' },
    { id: 'mystery', name: 'Misterio', icon: 'eye' },
    { id: 'romance', name: 'Romance', icon: 'heart-outline' },
    { id: 'science-fiction', name: 'Sci-Fi', icon: 'planet' },
    { id: 'thriller', name: 'Thriller', icon: 'warning' },
    { id: 'war', name: 'Guerra', icon: 'shield' },
    { id: 'western', name: 'Western', icon: 'star' },
  ];

  const handleGenrePress = (genre) => {
    onGenreSelect(genre);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        decelerationRate="fast"
        snapToInterval={120}
        snapToAlignment="start"
      >
        {genres.map((genre) => {
          const isSelected = selectedGenre === genre.id;
          return (
            <TouchableOpacity
              key={genre.id}
              style={[
                styles.genreButton,
                isSelected && styles.genreButtonActive
              ]}
              onPress={() => handleGenrePress(genre.id)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.iconContainer,
                isSelected && styles.iconContainerActive
              ]}>
                <Ionicons
                  name={genre.icon}
                  size={16}
                  color={isSelected ? '#fff' : '#9D50BB'}
                />
              </View>
              <Text style={[
                styles.genreText,
                isSelected && styles.genreTextActive
              ]}>
                {genre.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    backgroundColor: 'rgba(31, 3, 43, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 80, 187, 0.1)',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  genreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(157, 80, 187, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.3)',
    minWidth: 80,
    justifyContent: 'center',
  },
  genreButtonActive: {
    backgroundColor: '#9D50BB',
    borderColor: '#9D50BB',
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  iconContainer: {
    marginRight: 6,
  },
  iconContainerActive: {
    // No cambios adicionales para el icono activo
  },
  genreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9D50BB',
    letterSpacing: 0.2,
  },
  genreTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default GenreSlider;
