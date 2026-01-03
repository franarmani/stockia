import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Interceptor para agregar token JWT a todas las requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar respuestas y errores
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si el token expiró (401) e intentamos refrescar
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await apiClient.post('/auth/refresh', {
            refreshToken,
          });

          const { accessToken } = response.data;
          localStorage.setItem('token', accessToken);

          // Reintentar request original con nuevo token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Si falla el refresh, hacer logout
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export { apiClient };
