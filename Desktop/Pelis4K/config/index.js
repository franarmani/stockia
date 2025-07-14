// Configuration file for API keys and environment variables
export const config = {
  // Supabase Configuration
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://spesjjrmtphqwaklldkl.supabase.co',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2MTFmNWI5YjY1OWM1MDExOGM0NDg4YTBkZDAzNWVjZSIsInN1YiI6IjY0MmQ0ODQzNTgzNjFiMDBkMzM4ZTVlMyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.lramTlxnVOay_JY4djKCix-48VnOWYPRNsPl3A8b-bM',
  },

  // TMDB API Configuration
  tmdb: {
    token: process.env.EXPO_PUBLIC_TMDB_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2MTFmNWI5YjY1OWM1MDExOGM0NDg4YTBkZDAzNWVjZSIsInN1YiI6IjY0MmQ0ODQzNTgzNjFiMDBkMzM4ZTVlMyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.lramTlxnVOay_JY4djKCix-48VnOWYPRNsPl3A8b-bM',
    apiKey: process.env.EXPO_PUBLIC_TMDB_API_KEY || '201d333198374a91c81dba3c443b1a8e',
    baseURL: 'https://api.themoviedb.org/3',
    imageBaseURL: 'https://image.tmdb.org/t/p/w500',
  },

  // LiveKit Configuration
  livekit: {
    apiKey: process.env.EXPO_PUBLIC_LIVEKIT_API_KEY || 'APIuEJvhjpZaG7f',
    apiSecret: process.env.EXPO_PUBLIC_LIVEKIT_API_SECRET || '6TXDPvP7SSPMegekxOvz7nKOjTlLXNPesJZtPLaahudA',
    serverURL: process.env.EXPO_PUBLIC_LIVEKIT_SERVER_URL || 'wss://pelis4k-0yig90yr.livekit.cloud',
  },

  // Admin Configuration
  admin: {
    superAdminEmail: process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL || 'francoarmani107@gmail.com',
  },
};

export default config;
