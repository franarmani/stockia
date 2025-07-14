import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';

import { fetchDataFromApi } from './utils/api';
import { getApiConfiguration, getGenres } from './store/homeSlice';

import Header from './components/header/Header';
import Footer from './components/footer/Footer';
import CustomCursor from './components/customCursor/CustomCursor';
import TMDBDiagnostic from './components/TMDBDiagnostic';
import Home from './pages/home/Home';
import Details from './pages/details/Details';
import ChannelDetails from './pages/details/ChannelDetails';
import ChannelPlayerPage from './pages/channelPlayer/ChannelPlayerPage';

import SearchResult from './pages/searchResult/SearchResult';
import Explore from './pages/explore/Explore';
import ExploreChannels from './pages/explore/ExploreChannels';

import PageNotFound from './pages/404/PageNotFound';

const App = () => {
  const dispatch = useDispatch();
  const { url } = useSelector((state) => state.home);

  useEffect(() => {
    // MODO DEBUG: Desactivar temporalmente el service worker para testing
    const DEBUG_MODE = true; // Cambiar a false para activar el SW
    
    // Registrar service worker para ad blocking
    if ('serviceWorker' in navigator && !DEBUG_MODE) {
      navigator.serviceWorker.register('/sw-adblocker.js')
        .then((registration) => {
          console.log('🛡️ Ad Blocker SW registered successfully:', registration.scope);
        })
        .catch((error) => {
          console.log('❌ Ad Blocker SW registration failed:', error);
        });
    } else if (DEBUG_MODE) {
      console.log('🔧 DEBUG MODE: Service Worker disabled for testing');
      // Unregister any existing service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
          for(let registration of registrations) {
            registration.unregister();
            console.log('🗑️ Unregistered SW:', registration.scope);
          }
        });
      }
    }

    // Cargar configuración de la API y géneros al iniciar
    const fetchApiConfig = async () => {
      const res = await fetchDataFromApi('/configuration');
      const apiUrl = {
        backdrop: res.images.secure_base_url + 'original',
        poster: res.images.secure_base_url + 'original',
        profile: res.images.secure_base_url + 'original',
      };
      dispatch(getApiConfiguration(apiUrl));
    };

    const loadGenres = async () => {
      const endpoints = ['tv', 'movie'];
      const promises = endpoints.map((type) => fetchDataFromApi(`/genre/${type}/list`));
      const results = await Promise.all(promises);
      const allGenres = {};
      results.forEach(({ genres }) => {
        genres.forEach((g) => { allGenres[g.id] = g; });
      });
      dispatch(getGenres(allGenres));
    };

    fetchApiConfig();
    loadGenres();
  }, [dispatch]);

  useEffect(() => {
    // Mejorar velocidad de scroll con rueda del mouse
    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY || e.detail || e.wheelDelta;
      const scrollAmount = delta > 0 ? 120 : -120; // Aumentar velocidad
      
      window.scrollBy({
        top: scrollAmount,
        behavior: 'auto' // Scroll inmediato para mejor respuesta
      });
    };

    // Solo aplicar en desktop
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
      window.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (!isMobile) {
        window.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

// Componente separado para manejar el CustomCursor condicionalmente
const AppContent = () => {
  const location = useLocation();
  const isChannelPlayer = location.pathname.startsWith('/channel-player');

  return (
    <>
      {/* Mostrar CustomCursor en todas las rutas, incluyendo el reproductor */}
      <CustomCursor />
      
      <Routes>
        {/* Ruta especial para el reproductor de canales (sin header/footer) */}
        <Route path='/channel-player/:id' element={<ChannelPlayerPage />} />
        
        {/* Rutas normales con header y footer */}
        <Route path='/*' element={<MainApp />} />
      </Routes>
    </>
  );
};

// Componente para las rutas principales con header y footer
const MainApp = () => {
  return (
    <>
      <Header />
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/channel/:id' element={<ChannelDetails />} /> 
        <Route path='/explore/:mediaType' element={<Explore />} />
        <Route path='/explore-channels' element={<ExploreChannels />} />  
        <Route path='/search/:query' element={<SearchResult />} />
        <Route path='/:mediaType/:id' element={<Details />} />
        <Route path='/404' element={<PageNotFound />} />
        <Route path='*' element={<Navigate replace to='/404' />} />
      </Routes>
      <Footer />
    </>
  );
};

export default App;
