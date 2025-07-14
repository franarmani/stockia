import React from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

const HorizontalSlider = ({ 
  data, 
  title, 
  onItemPress, 
  itemWidth = 120,
  itemHeight = 180,
  showChannelStyle = false 
}) => {
  const renderItem = ({ item }) => {
    if (showChannelStyle) {
      return (
        <View style={[styles.channelContainer, { width: itemWidth }]}>
          <TouchableOpacity onPress={() => onItemPress(item)}>
            <Image
              source={{ uri: item.logo || item.image }}
              style={[styles.channelImage, { width: itemWidth * 0.75, height: itemWidth * 0.75 }]}
              resizeMode="contain"
            />
            <Text style={styles.channelTitle} numberOfLines={1}>
              {item.name}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.itemContainer, { width: itemWidth }]}>
        <TouchableOpacity onPress={() => onItemPress(item)}>
          <Image
            source={{ uri: item.poster_path || item.image }}
            style={[styles.itemImage, { width: itemWidth, height: itemHeight }]}
            resizeMode="cover"
          />
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.title || item.name}
          </Text>
          {item.release_date && (
            <Text style={styles.itemYear}>
              {item.release_date.substring(0, 4)}
            </Text>
          )}
          {item.calidad && (
            <Text style={styles.itemQuality}>
              {item.calidad}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <FlatList
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => `${title}-${index}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        snapToInterval={itemWidth + 15}
        decelerationRate="fast"
        snapToAlignment="start"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    backgroundColor: '#1f032b',
    paddingVertical: 15,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  title: {
    fontSize: 16, // Reducido de 18 a 16
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 15,
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  listContainer: {
    paddingLeft: 15,
  },
  itemContainer: {
    marginRight: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    padding: 5,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  itemImage: {
    borderRadius: 8,
    backgroundColor: '#2a0438',
  },
  itemTitle: {
    fontSize: 11, // Reducido de 12 a 11
    color: '#fff',
    marginTop: 5,
    textAlign: 'center',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  itemYear: {
    fontSize: 9, // Reducido de 10 a 9
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 2,
  },
  itemQuality: {
    fontSize: 9, // Reducido de 10 a 9
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 2,
    fontWeight: 'bold',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  channelContainer: {
    marginRight: 15,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    padding: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  channelImage: {
    borderRadius: 40,
    backgroundColor: '#2a0438',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  channelTitle: {
    fontSize: 11, // Reducido de 12 a 11
    color: '#fff',
    marginTop: 5,
    textAlign: 'center',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});

export default HorizontalSlider;
