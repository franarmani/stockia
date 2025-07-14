import axios from "axios";

const BASE_URL = "https://api.themoviedb.org/3";
const API_KEY = import.meta.env.VITE_APP_TMDB_API_KEY;  // Usa la Key v3 (no token)

export const fetchDataFromApi = async (endpoint, params = {}) => {
  try {
    if (!API_KEY) {
      console.error("❌ TMDB API Key is missing! Check your environment variables.");
      throw new Error("API Key is required");
    }

    const fullUrl = `${BASE_URL}${endpoint}`;
    console.log(`🎬 Making TMDB API Call to:`, fullUrl);
    console.log(`🔑 Using API Key:`, API_KEY ? 'Present' : 'Missing');
    
    const { data } = await axios.get(fullUrl, {
      params: {
        api_key: API_KEY,  // 👈 Aquí la clave pública en query param
        language: "es-ES",
        ...params,
      },
    });
    
    console.log(`✅ TMDB API Success for ${endpoint}:`, data);
    return data;
  } catch (err) {
    console.error(`❌ TMDB API Error for ${endpoint}:`, err.response?.data || err.message);
    console.error("Full error object:", err);
    throw err;
  }
};
