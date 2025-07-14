import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Alert,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';

const { width } = Dimensions.get('window');

const BannerCarousel = ({ data, onItemPress, autoPlay = true, interval = 5000 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (!autoPlay || !data || data.length <= 1) return;

    const timer = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0.7,
        duration: 400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        // Change image
        setCurrentIndex((prevIndex) => (prevIndex + 1) % Math.min(data.length, 5));
        
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start();
      });
    }, interval);

    return () => clearInterval(timer);
  }, [data, autoPlay, interval, fadeAnim]);

  const changeSlide = (direction) => {
    const bannerItems = data.slice(0, 5);
    
    Animated.timing(fadeAnim, {
      toValue: 0.7,
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      if (direction === 'next') {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % bannerItems.length);
      } else {
        setCurrentIndex((prevIndex) => (prevIndex - 1 + bannerItems.length) % bannerItems.length);
      }
      
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    });
  };

  const handlePlayPress = (item) => {
    Alert.alert(
      'Reproducir',
      `¿Quieres reproducir "${item.title || item.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Reproducir', 
          onPress: () => {
            if (item.link) {
              WebBrowser.openBrowserAsync(item.link);
            } else {
              Alert.alert('Error', 'No hay enlace disponible');
            }
          }
        }
      ]
    );
  };

  if (!data || data.length === 0) {
    return null;
  }

  const bannerItems = data.slice(0, 5);
  const currentItem = bannerItems[currentIndex];

  const handleDotPress = (index) => {
    Animated.timing(fadeAnim, {
      toValue: 0.7,
      duration: 250,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex(index);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.bannerContainer}>
        <Animated.View style={[styles.imageContainer, { opacity: fadeAnim }]}>
          <Image
            source={{ uri: currentItem?.poster_path || currentItem?.image }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
          
          {/* Overlay decorativo */}
          <View style={styles.decorativeOverlay} />
        </Animated.View>
        
        {/* Gradientes fijos - siempre visibles */}
        <LinearGradient
          colors={[
            'rgba(31, 3, 43, 0.3)', 
            'rgba(31, 3, 43, 0.7)', 
            'rgba(31, 3, 43, 0.9)'
          ]}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <LinearGradient
          colors={[
            'transparent', 
            'rgba(31, 3, 43, 0.8)', 
            'rgba(31, 3, 43, 0.98)'
          ]}
          style={styles.gradientBottom}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        
        <View style={styles.contentContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {currentItem?.title || currentItem?.name}
          </Text>
          <Text style={styles.description} numberOfLines={3}>
            {currentItem?.overview || currentItem?.description}
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => handlePlayPress(currentItem)}
              activeOpacity={0.8}
            >
              <Ionicons name="play" size={14} color="#fff" />
              <Text style={styles.playButtonText}>Reproducir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Indicators */}
      <View style={styles.indicators}>
        {bannerItems.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              index === currentIndex ? styles.activeIndicator : styles.indicator
            ]}
            onPress={() => handleDotPress(index)}
            activeOpacity={0.7}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 300, 
    position: 'relative',
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    overflow: 'hidden',
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  bannerContainer: {
    flex: 1,
    position: 'relative',
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.02 }],
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.9,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  contentContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
    paddingBottom: 40,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    letterSpacing: 0.6,
    lineHeight: 24,
  },
  description: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    fontWeight: '400',
    maxWidth: '85%',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 5,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9D50BB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    elevation: 6,
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 110,
    justifyContent: 'center',
  },
  playButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
    letterSpacing: 0.4,
  },
  indicators: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },
  activeIndicator: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9D50BB',
    marginHorizontal: 3,
    elevation: 3,
    shadowColor: '#9D50BB',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  // Overlay decorativo más sutil
  decorativeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(157, 80, 187, 0.05)',
    pointerEvents: 'none',
  },
  // Borde brillante más sutil
  glowBorder: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: 0,
    backgroundColor: 'rgba(157, 80, 187, 0.2)',
    opacity: 0.6,
    zIndex: -1,
  },
});

export default BannerCarousel;
