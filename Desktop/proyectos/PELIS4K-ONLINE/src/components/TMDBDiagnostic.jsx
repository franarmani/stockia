import React, { useEffect, useState } from 'react';

const TMDBDiagnostic = () => {
  const [diagnostics, setDiagnostics] = useState({
    imageTest: 'testing',
    apiTest: 'testing',
    extensionCheck: 'testing'
  });

  useEffect(() => {
    const runDiagnostics = async () => {
      const results = { ...diagnostics };

      // Test 1: Cargar imagen de TMDB
      const testImage = () => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve('✅ Working');
          img.onerror = () => resolve('❌ Blocked');
          img.src = 'https://image.tmdb.org/t/p/w92/1E5baAaEse26fej7uHcjOgEE2t2.jpg';
          
          // Timeout después de 5 segundos
          setTimeout(() => resolve('⏱️ Timeout'), 5000);
        });
      };

      // Test 2: Probar API de TMDB
      const testAPI = () => {
        return fetch('https://api.themoviedb.org/3/configuration', { method: 'HEAD' })
          .then(() => '✅ Accessible')
          .catch(() => '❌ Blocked');
      };

      // Test 3: Detectar extensiones que bloquean ads
      const checkExtensions = () => {
        const adBlockerTests = [
          // Test para uBlock Origin
          () => {
            const el = document.createElement('div');
            el.innerHTML = '&nbsp;';
            el.className = 'adsbox';
            document.body.appendChild(el);
            const blocked = el.offsetHeight === 0;
            document.body.removeChild(el);
            return blocked;
          },
          // Test para Adblock Plus
          () => {
            const el = document.createElement('div');
            el.innerHTML = '&nbsp;';
            el.className = 'ad-banner';
            document.body.appendChild(el);
            const blocked = el.offsetHeight === 0;
            document.body.removeChild(el);
            return blocked;
          }
        ];

        const detected = adBlockerTests.some(test => test());
        return detected ? '⚠️ Ad blocker detected' : '✅ No blocking detected';
      };

      // Ejecutar tests
      results.imageTest = await testImage();
      results.apiTest = await testAPI();
      results.extensionCheck = checkExtensions();

      setDiagnostics(results);
    };

    runDiagnostics();
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '8px',
      fontSize: '12px',
      zIndex: 9999,
      fontFamily: 'monospace'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>🔍 TMDB Diagnostic</div>
      <div>Image Loading: {diagnostics.imageTest}</div>
      <div>API Access: {diagnostics.apiTest}</div>
      <div>Extensions: {diagnostics.extensionCheck}</div>
    </div>
  );
};

export default TMDBDiagnostic;
