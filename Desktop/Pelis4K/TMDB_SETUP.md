# Configuración de TMDB API

Para que la aplicación muestre contenido trending basado en TMDB, necesitas configurar una API key.

## Pasos para obtener la API key:

1. **Crear cuenta en TMDB**:
   - Ve a [https://www.themoviedb.org/](https://www.themoviedb.org/)
   - Crea una cuenta gratuita o inicia sesión

2. **Solicitar API key**:
   - Ve a tu perfil (esquina superior derecha)
   - Selecciona "Configuración" → "API"
   - Haz clic en "Solicitar una clave API"
   - Selecciona "Desarrollador" 
   - Completa el formulario con información básica sobre tu aplicación

3. **Configurar la API key**:
   - Copia la API key que te proporcionaron
   - Abre el archivo `utils/tmdbConfig.js`
   - Pega tu API key en el campo `API_KEY`

```javascript
export const TMDB_CONFIG = {
  API_KEY: 'tu_api_key_aquí', // Pega tu API key aquí
  BASE_URL: 'https://api.themoviedb.org/3',
  IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/w500',
  BACKDROP_BASE_URL: 'https://image.tmdb.org/t/p/w1280',
};
```

## Funcionalidad:

- **Con API key configurada**: La app buscará contenido trending en TMDB y mostrará solo el que esté disponible en tu `data.json`
- **Sin API key**: La app usará criterios locales para determinar qué contenido mostrar como trending

## Beneficios de usar TMDB:

- Contenido realmente trending basado en datos reales
- Imágenes de alta calidad
- Información adicional sobre popularidad y rating
- Actualización automática del contenido trending

La API de TMDB es gratuita y permite hasta 1,000 requests por día, lo cual es más que suficiente para esta aplicación.
