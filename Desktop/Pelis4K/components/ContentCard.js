import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const cardWidth = (width - 60) / 3; // 3 cards por fila con menos espacio entre ellas para que sean más grandes

const ContentCard = ({ item, onPress, onCast, type, viewMode = 'grid' }) => {
  // No renderizar si no hay datos básicos
  if (!item || (!item.title && !item.name)) {
    return null;
  }

  // Función para obtener color del tipo de contenido - Todo violeta
  const getTypeColor = (contentType) => {
    // Usar solo gama violeta para todos los tipos
    return ['#9D50BB', '#7B2D9E'];
  };

  // Función para obtener icono del tipo de contenido
  const getTypeIcon = (contentType) => {
    const icons = {
      'movie': 'film',
      'series': 'play-circle',
      'anime': 'radio',
      'channel': 'tv',
    };
    return icons[contentType] || 'play';
  };

  // Función para obtener badge del tipo
  const getTypeBadge = (contentType) => {
    const badges = {
      'movie': '4K',
      'series': 'HD',
      'anime': 'SUB',
      'channel': 'LIVE',
    };
    return badges[contentType] || 'HD';
  };

  // Función para obtener color basado en la categoría (para canales) - Todo violeta
  const getCategoryColor = (categoria) => {
    // Usar solo gama violeta para todas las categorías
    return ['#9D50BB', '#7B2D9E'];
  };

  // Función para obtener icono basado en la categoría (para canales)
  const getCategoryIcon = (categoria) => {
    if (!categoria) return 'tv';
    
    const icons = {
      'deportes': 'football',
      'noticias': 'newspaper',
      'entretenimiento': 'happy',
      'infantil': 'heart',
      'música': 'musical-notes',
      'películas': 'film',
      'series': 'play',
      'cultura': 'library',
      'religioso': 'star',
      'nacional': 'flag',
      'internacional': 'globe',
    };
    
    const key = categoria.toLowerCase();
    return icons[key] || 'tv';
  };

  // Función para obtener color de texto basado en el fondo (para canales)
  const getTextColor = (categoria) => {
    // Siempre usar texto blanco sobre fondo violeta
    return '#fff';
  };

  const typeColors = getTypeColor(type);
  const typeIcon = getTypeIcon(type);
  const typeBadge = getTypeBadge(type);

  // Si es un canal de TV (tiene categoría), usar diseño de canal vertical
  if (item.categoria) {
    const gradientColors = getCategoryColor(item.categoria);
    const categoryIcon = getCategoryIcon(item.categoria);
    const textColor = getTextColor(item.categoria);

    return (
      <TouchableOpacity style={styles.channelCard} onPress={() => onPress(item)} activeOpacity={0.8}>
        {/* Header con icono de categoría */}
        <View style={styles.channelHeader}>
          <View style={[styles.channelIconContainer, { backgroundColor: gradientColors[0] }]}>
            <Ionicons name={categoryIcon} size={20} color={textColor} />
          </View>
          <View style={[styles.channelCategoryBadge, { backgroundColor: 'rgba(157, 80, 187, 0.2)' }]}>
            <Text style={[styles.channelCategoryText, { color: '#9D50BB' }]} numberOfLines={1}>
              {item.categoria}
            </Text>
          </View>
        </View>

        {/* Información del canal */}
        <View style={styles.channelContent}>
          {/* Título del canal */}
          <Text style={styles.channelTitle} numberOfLines={2}>
            {item.title || item.name}
          </Text>
          
          {/* País */}
          <View style={styles.channelInfo}>
            {item.pais && (
              <Text style={styles.countryLabel}>{item.pais}</Text>
            )}
          </View>

          {/* Footer con calidad y play */}
          <View style={styles.channelFooter}>
            <View style={styles.qualityContainer}>
              <Text style={styles.qualityLabel}>LIVE</Text>
            </View>
            <View style={[styles.playIcon, { backgroundColor: gradientColors[0] }]}>
              <Ionicons name="play" size={10} color={textColor} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Diseño profesional para películas, series y anime
  return (
    <TouchableOpacity 
      style={viewMode === 'grid' ? styles.contentCard : styles.contentCardList} 
      onPress={() => onPress(item)} 
      activeOpacity={0.8}
    >
      {/* Imagen del contenido */}
      <View style={viewMode === 'grid' ? styles.imageContainer : styles.imageContainerList}>
        {(item.poster_path || item.image) ? (
          <Image 
            source={{ uri: item.poster_path || item.image }} 
            style={viewMode === 'grid' ? styles.contentImage : styles.contentImageList}
            resizeMode="cover"
          />
        ) : (
          <View style={viewMode === 'grid' ? styles.placeholderImage : styles.placeholderImageList}>
            <Ionicons 
              name={typeIcon}
              size={viewMode === 'grid' ? 48 : 32} 
              color="rgba(157, 80, 187, 0.4)" 
            />
          </View>
        )}
        
        {/* Overlay con gradiente */}
        <View style={styles.imageOverlay}>
          {/* Icono de play en el centro */}
          {viewMode === 'grid' && (
            <View style={styles.playOverlay}>
              <View style={[styles.playButton, { backgroundColor: typeColors[0] }]}>
                <Ionicons name="play" size={24} color="#fff" />
              </View>
            </View>
          )}
          
          {/* Botón de Chromecast Real */}
          {viewMode === 'grid' && (
            <TouchableOpacity 
              style={styles.castButton}
              onPress={(e) => {
                e.stopPropagation();
                onCast && onCast(item);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="tv" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Información del contenido */}
      <View style={viewMode === 'grid' ? styles.contentInfo : styles.contentInfoList}>
        <Text style={viewMode === 'grid' ? styles.contentTitle : styles.contentTitleList} numberOfLines={viewMode === 'grid' ? 2 : 1}>
          {item.title || item.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Estilos para canales de TV - Diseño limpio sin imagen
  channelCard: {
    backgroundColor: 'rgba(26, 2, 37, 0.95)',
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.2)',
    overflow: 'hidden',
    flex: 1,
    margin: 6,
    maxWidth: '30%',
    minHeight: 140, // Reducido de 180 a 140 para cards más pequeñas
  },
  
  // Header del canal con icono
  channelHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 12, // Reducido de 16 a 12
    paddingVertical: 12, // Reducido de 20 a 12
    backgroundColor: 'rgba(157, 80, 187, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 80, 187, 0.15)',
  },
  
  channelIconContainer: {
    width: 36, // Reducido de 48 a 36
    height: 36, // Reducido de 48 a 36
    borderRadius: 18, // Ajustado proporcionalmente
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8, // Reducido de 12 a 8
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  
  channelCategoryBadge: {
    paddingHorizontal: 8, // Reducido de 12 a 8
    paddingVertical: 4, // Reducido de 6 a 4
    borderRadius: 10, // Reducido de 12 a 10
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.3)',
  },
  
  channelCategoryText: {
    fontSize: 9, // Reducido de 10 a 9
    fontWeight: '700',
    letterSpacing: 0.4, // Reducido de 0.5 a 0.4
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  
  channelHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: 'rgba(157, 80, 187, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 80, 187, 0.15)',
  },
  
  channelContent: {
    padding: 12, // Reducido de 16 a 12
    flex: 1,
    justifyContent: 'space-between',
  },
  
  channelTitle: {
    fontSize: 11, // Reducido de 12 a 11
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8, // Reducido de 12 a 8
    lineHeight: 14, // Reducido de 16 a 14
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  channelInfo: {
    alignItems: 'center',
    marginBottom: 10, // Reducido de 16 a 10
  },
  
  countryLabel: {
    fontSize: 9, // Reducido de 10 a 9
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8, // Reducido de 10 a 8
    paddingVertical: 3, // Reducido de 4 a 3
    borderRadius: 6, // Reducido de 8 a 6
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  
  channelFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8, // Reducido de 12 a 8
    borderTopWidth: 1,
    borderTopColor: 'rgba(157, 80, 187, 0.15)',
  },
  
  qualityContainer: {
    flex: 1,
  },
  
  qualityLabel: {
    fontSize: 9, // Reducido de 10 a 9
    color: '#9D50BB',
    fontWeight: '700',
    backgroundColor: 'rgba(157, 80, 187, 0.15)',
    paddingHorizontal: 6, // Reducido de 8 a 6
    paddingVertical: 3, // Reducido de 4 a 3
    borderRadius: 6, // Reducido de 8 a 6
    textAlign: 'center',
    letterSpacing: 0.4, // Reducido de 0.5 a 0.4
    textTransform: 'uppercase',
  },
  
  playIcon: {
    width: 20, // Reducido de 24 a 20
    height: 20, // Reducido de 24 a 20
    borderRadius: 10, // Ajustado proporcionalmente
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  // Estilos para contenido (películas, series, anime) - Diseño profesional
  contentCard: {
    borderRadius: 16,
    overflow: 'hidden',
    margin: 6, // Reducido margen para cards más grandes
    width: cardWidth,
    height: cardWidth * 1.9, // Reducido de 2.2 a 1.9 para cards más compactas
  },
  
  imageContainer: {
    position: 'relative',
    height: cardWidth * 1.4, // Reducido de 1.7 a 1.4 para imagen más compacta
    width: '100%',
    borderRadius: 12, // Agregar bordes redondeados a la imagen
    overflow: 'hidden', // Para que la imagen respete el borderRadius
  },
  
  contentImage: {
    width: '100%',
    height: '100%',
  },
  
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(15, 1, 24, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12, // Agregar bordes redondeados al placeholder
  },
  
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  playOverlay: {
    opacity: 0.4, // Reducido de 0.9 a 0.4 para más transparencia
  },
  
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  
  castButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(157, 80, 187, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  
  contentInfo: {
    paddingHorizontal: 6, // Solo padding horizontal
    paddingTop: 4, // Reducido de 6 a 4
    paddingBottom: 1, // Reducido de 2 a 1 para mínimo espacio
    height: cardWidth * 0.5, // Reducido de 0.8 a 0.5 para menos espacio
    justifyContent: 'flex-start', // Cambiar de space-between a flex-start
  },
  
  contentTitle: {
    fontSize: 11, // Reducido de 12 a 11 para título más pequeño
    fontWeight: '700',
    color: '#fff',
    lineHeight: 13, // Reducido de 14 a 13 para menos altura
    marginBottom: 0, // Eliminado marginBottom para sin espacio debajo
    minHeight: 26, // Altura mínima para 2 líneas de texto
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center', // Centrar el texto
    paddingHorizontal: 8, // Agregar padding horizontal
    paddingVertical: 4, // Agregar padding vertical
  },

  // Estilos para modo lista (películas, series, anime)
  contentCardList: {
    backgroundColor: 'rgba(26, 2, 37, 0.95)',
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 187, 0.2)',
    overflow: 'hidden',
    margin: 6,
    width: width - 32,
    height: 120,
    flexDirection: 'row',
  },

  imageContainerList: {
    position: 'relative',
    width: 80,
    height: '100%',
  },

  contentImageList: {
    width: '100%',
    height: '100%',
  },

  placeholderImageList: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(15, 1, 24, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  contentInfoList: {
    paddingHorizontal: 6, // Solo padding horizontal
    paddingTop: 4, // Reducido de 6 a 4
    paddingBottom: 1, // Reducido de 2 a 1 para menos espacio
    height: 60, // Reducido de 80 a 60 para modo lista más compacto
    justifyContent: 'flex-start', // Cambiar de space-between a flex-start
  },

  contentTitleList: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 18,
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default ContentCard;
