// Test específico para verificar conectividad de TMDB
const testTMDBImages = () => {
  console.log('🔍 Testing TMDB image connectivity...');
  
  // Test imagen específica
  const testImageUrl = 'https://image.tmdb.org/t/p/w500/test.jpg';
  const img = new Image();
  
  img.onload = () => {
    console.log('✅ TMDB images accessible');
  };
  
  img.onerror = (error) => {
    console.error('❌ TMDB images blocked or unavailable:', error);
    console.log('Checking if ad blocker or extensions are interfering...');
    
    // Check if requests are being blocked
    fetch('https://image.tmdb.org/t/p/w500/', { method: 'HEAD' })
      .then(() => console.log('✅ TMDB image domain is accessible via fetch'))
      .catch(err => console.error('❌ TMDB image domain blocked via fetch:', err));
  };
  
  img.src = testImageUrl;
  
  // Test API endpoint
  fetch('https://api.themoviedb.org/3/configuration?api_key=your_key_here', { method: 'HEAD' })
    .then(() => console.log('✅ TMDB API domain is accessible'))
    .catch(err => console.log('⚠️ TMDB API test (expected failure without key):', err.message));
};

// Run test
testTMDBImages();

export default testTMDBImages;
