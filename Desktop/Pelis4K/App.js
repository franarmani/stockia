import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import HomeScreen from './screens/HomeScreen';
import MoviesScreen from './screens/MoviesScreen';
import SeriesScreen from './screens/SeriesScreen';
import AnimeScreen from './screens/AnimeScreen';
import ChannelsScreen from './screens/ChannelsScreen';
import SearchResults from './screens/SearchResults';
import SearchScreen from './screens/SearchScreen';
import TVPlayerScreen from './screens/TVPlayerScreen';
import DetailsScreen from './screens/DetailsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack Navigator for Home Screen (to handle search results)
const HomeStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="SearchResults" component={SearchResults} />
    </Stack.Navigator>
  );
};

// Stack Navigator for Movies Screen (to handle details)
const MoviesStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoviesMain" component={MoviesScreen} />
      <Stack.Screen name="Details" component={DetailsScreen} />
    </Stack.Navigator>
  );
};

// Stack Navigator for Series Screen (to handle details)
const SeriesStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SeriesMain" component={SeriesScreen} />
      <Stack.Screen name="Details" component={DetailsScreen} />
    </Stack.Navigator>
  );
};

// Stack Navigator for Anime Screen (to handle details)
const AnimeStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AnimeMain" component={AnimeScreen} />
      <Stack.Screen name="Details" component={DetailsScreen} />
    </Stack.Navigator>
  );
};

// Stack Navigator for Channels Screen (to handle TV player)
const ChannelsStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChannelsMain" component={ChannelsScreen} />
      <Stack.Screen name="TVPlayer" component={TVPlayerScreen} />
    </Stack.Navigator>
  );
};

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor="#1f032b" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Inicio') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Búsqueda') {
              iconName = focused ? 'search' : 'search-outline';
            } else if (route.name === 'Películas') {
              iconName = focused ? 'film' : 'film-outline';
            } else if (route.name === 'Series') {
              iconName = focused ? 'tv' : 'tv-outline';
            } else if (route.name === 'Anime') {
              iconName = focused ? 'flash' : 'flash-outline';
            } else if (route.name === 'Canales') {
              iconName = focused ? 'desktop' : 'desktop-outline';
            }

            return (
              <View style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: focused ? 'rgba(157, 80, 187, 0.15)' : 'transparent',
                borderWidth: focused ? 2 : 0,
                borderColor: focused ? '#9D50BB' : 'transparent',
              }}>
                <Ionicons 
                  name={iconName} 
                  size={24} 
                  color={focused ? '#9D50BB' : 'rgba(255, 255, 255, 0.6)'} 
                />
              </View>
            );
          },
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: '#1f032b',
            borderTopWidth: 0,
            height: 80,
            paddingBottom: 15,
            paddingTop: 15,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.2,
            shadowRadius: 10,
          },
          tabBarItemStyle: {
            paddingVertical: 0,
          },
        })}
      >
        <Tab.Screen name="Inicio" component={HomeStack} />
        <Tab.Screen name="Búsqueda" component={SearchScreen} />
        <Tab.Screen name="Películas" component={MoviesStack} />
        <Tab.Screen name="Series" component={SeriesStack} />
        <Tab.Screen name="Anime" component={AnimeStack} />
        <Tab.Screen name="Canales" component={ChannelsStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
