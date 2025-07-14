// Configuración de la aplicación
const config = {
  tmdb: {
    apiKey: 'tu_api_key_aqui', // Reemplazar con tu API key de TMDB
    baseURL: 'https://api.themoviedb.org/3',
    imageBaseURL: 'https://image.tmdb.org/t/p/w500',
  },
  
  // URLs de ejemplo para videos de demostración
  demoVideos: {
    movie: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    series: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    anime: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  }
};

export default config;
