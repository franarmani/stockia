// Middleware para asegurar que TMDB siempre funcione
const ensureTMDBAccess = () => {
  // Override de Image constructor para detectar bloqueos
  const originalImage = window.Image;
  window.Image = function() {
    const img = new originalImage();
    const originalSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    
    Object.defineProperty(img, 'src', {
      set: function(value) {
        if (value && value.includes('tmdb.org')) {
          console.log('📸 Loading TMDB image:', value);
        }
        originalSrc.set.call(this, value);
      },
      get: function() {
        return originalSrc.get.call(this);
      }
    });
    
    return img;
  };
  
  // Detectar si hay extensiones bloqueando
  const testTMDBAccess = () => {
    const testImg = new Image();
    testImg.onload = () => console.log('✅ TMDB images working correctly');
    testImg.onerror = (e) => {
      console.warn('⚠️ TMDB image loading failed - checking for blockers');
      console.log('Check if ad blocker extensions are interfering');
    };
    testImg.src = 'https://image.tmdb.org/t/p/w92/1E5baAaEse26fej7uHcjOgEE2t2.jpg'; // Small test image
  };
  
  // Test al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testTMDBAccess);
  } else {
    testTMDBAccess();
  }
  
  console.log('🔧 TMDB access middleware initialized');
};

export default ensureTMDBAccess;
