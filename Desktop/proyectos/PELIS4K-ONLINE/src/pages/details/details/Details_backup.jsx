import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import useFetch from './../../hooks/useFetch';
import { loadLocalData } from '../../utils/localDataService';
import DetailsBanner from './detailsBanner/DetailsBanner';
import Cast from './cast/Cast';
import VideosSection from './videosSection/VideosSection';
import Similar from './carousels/Similar';
import Recommendation from './carousels/Recommendations';
import AdBlockerStatus from '../../components/adBlockerStatus/AdBlockerStatus';
import './stylechannel.scss';

const Details = () => {
  const { mediaType, id } = useParams();
  const { data: tmdbData, loading: tmdbLoading } = useFetch(`/${mediaType}/${id}`);
  const { data: credits, loading: creditsLoading } = useFetch(`/${mediaType}/${id}/credits`);
  const [localData, setLocalData] = useState(null);
  const [error, setError] = useState(false);
  const [selectedLink, setSelectedLink] = useState('');
  const [activeSeason, setActiveSeason] = useState(null);
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [iframeError, setIframeError] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastDataHash, setLastDataHash] = useState(null);
  const [iframeKey, setIframeKey] = useState(0);
  
  const iframeRef = useRef(null);
  const containerRef = useRef(null);

  // Function to return the original URL without modification
  const createPlayerUrl = (originalUrl) => {
    if (!originalUrl) return '';
    console.log('🎥 Using original URL directly:', originalUrl);
    return originalUrl;
  };

  // Function to create a simple hash of the data
  const createDataHash = (data) => {
    if (!data) return null;
    const dataString = JSON.stringify(data, ['id', 'link', 'seasons', 'episodes']);
    return dataString.length + '_' + btoa(dataString).slice(0, 10);
  };

  // Function to fetch and verify local data
  const fetchLocalData = async (forceRefresh = false) => {
    setError(false);
    try {
      console.log('🔄 Verificando datos locales...', { forceRefresh, mediaType, id });
      
      const data = await loadLocalData();
      
      let found = null;
      if (mediaType === 'movie') {
        found = data.movies?.find(movie => {
          const movieId = movie.id ? movie.id.toString() : null;
          return movieId === id;
        });
      } else if (mediaType === 'tv' || mediaType === 'series') {
        found = data.series?.find(serie => {
          const serieId = serie.id ? serie.id.toString() : null;
          return serieId === id;
        });
      }

      const currentHash = createDataHash(found);
      
      if (forceRefresh || !lastDataHash || lastDataHash !== currentHash) {
        console.log('🔄 Data has changed, updating...');
        
        setLocalData(found || null);
        setLastDataHash(currentHash);

        if (found) {
          if (mediaType === 'movie') {
            const firstLink = typeof found.link === 'object'
              ? Object.values(found.link).find(url => url)
              : found.link;
            
            if (firstLink && firstLink !== '' && firstLink !== 'Enlace de streaming no disponible') {
              const playerUrl = createPlayerUrl(firstLink);
              setSelectedLink(playerUrl);
            } else {
              setSelectedLink('');
            }
          } else if (mediaType === 'tv' || mediaType === 'series') {
            if (found.seasons && found.seasons.length > 0) {
              const firstSeason = found.seasons[0];
              setActiveSeason(firstSeason?.season_number);
              const firstEpisode = firstSeason?.episodes?.[0];
              
              if (firstEpisode && firstEpisode.link) {
                const playerUrl = createPlayerUrl(firstEpisode.link);
                setSelectedLink(playerUrl);
                setActiveEpisode(firstEpisode.episode_number);
              } else {
                setSelectedLink('');
                setActiveEpisode(null);
              }
            } else {
              setSelectedLink('');
            }
          }
        } else {
          setSelectedLink('');
          setActiveEpisode(null);
        }
      }
    } catch (error) {
      console.error('❌ Error cargando datos locales:', error);
      setError(true);
    }
  };

  // Initial load effect
  useEffect(() => {
    console.log('🚀 Initial load for:', { mediaType, id });
    setActiveEpisode(null);
    setActiveSeason(null);
    setSelectedLink('');
    setIframeError(false);
    setIframeLoading(false);
    fetchLocalData(true);
  }, [mediaType, id]);

  // Auto-refresh effect
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLocalData(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [mediaType, id, lastDataHash]);

  // FAST link selection - Optimized for speed
  const handleLinkSelection = async (originalLink, episodeNumber = null) => {
    console.log('🔗 Quick episode change:', { originalLink, episodeNumber });
    
    const playerUrl = createPlayerUrl(originalLink);
    
    // Update states immediately
    setIframeError(false);
    setIframeLoading(true);
    setRetryCount(0);
    
    if (episodeNumber !== null) {
      setActiveEpisode(episodeNumber);
    }
    
    // Force iframe reload with minimal delay
    setIframeKey(prev => prev + 1);
    
    // Very fast update - just 50ms total delay
    setTimeout(() => {
      setSelectedLink(playerUrl);
    }, 50);
  };

  // Add timeout for iframe loading
  useEffect(() => {
    if (iframeLoading && selectedLink) {
      const timeout = setTimeout(() => {
        console.log('⚠️ Iframe loading timeout');
        setIframeLoading(false);
      }, 5000); // Fast 5 second timeout

      return () => clearTimeout(timeout);
    }
  }, [iframeLoading, selectedLink, iframeKey, activeEpisode]);

  // Handle iframe errors
  const handleIframeError = (e) => {
    console.error('Error iframe:', e);
    setIframeError(true);
    setIframeLoading(false);
  };

  const handleIframeLoad = () => {
    console.log('✅ Iframe loaded successfully');
    setIframeError(false);
    setIframeLoading(false);
    setRetryCount(0);
  };

  const retryIframe = () => {
    if (retryCount < 3) {
      setIframeError(false);
      setIframeLoading(true);
      setRetryCount(prev => prev + 1);
      setIframeKey(prev => prev + 1);
    }
  };

  const getButtonStyle = (isActive) => ({
    background: isActive ? 'linear-gradient(135deg, #8e2de2, #4a00e0)' : '#2c2c2c',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '25px',
    fontWeight: isActive ? 'bold' : 'normal',
    cursor: 'pointer',
    margin: '5px',
    transition: 'all 0.3s ease',
    boxShadow: isActive ? '0 4px 12px rgba(142,45,226,0.5)' : '0 2px 6px rgba(0,0,0,0.3)',
    textTransform: 'uppercase',
    fontSize: '14px',
    letterSpacing: '1px'
  });

  const seasonButtonStyle = (isActive) => ({
    background: isActive ? 'linear-gradient(135deg, #8e2de2, #4a00e0)' : '#2c2c2c',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '20px',
    fontWeight: isActive ? 'bold' : 'normal',
    cursor: 'pointer',
    margin: '4px',
    transition: 'all 0.3s ease',
    boxShadow: isActive ? '0 2px 8px rgba(142, 45, 226, 0.4)' : '0 1px 4px rgba(0, 0, 0, 0.2)',
    fontSize: '12px',
    letterSpacing: '0.5px'
  });

  const episodeButtonStyle = (isActive) => ({
    background: isActive ? '#6c757d' : '#495057',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '15px',
    fontWeight: isActive ? '600' : 'normal',
    cursor: 'pointer',
    margin: '3px',
    transition: 'all 0.3s ease',
    boxShadow: isActive ? '0 2px 6px rgba(0, 0, 0, 0.4)' : '0 1px 3px rgba(0, 0, 0, 0.2)',
    fontSize: '11px',
    letterSpacing: '0.3px'
  });

  return (
    <div>
      {!tmdbLoading && tmdbData && (
        <>
          <DetailsBanner data={tmdbData} crew={credits?.crew} />
          <Cast data={credits?.cast} loading={creditsLoading} />
          <VideosSection data={tmdbData?.videos} loading={tmdbLoading} />
        </>
      )}

      {localData && (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          {mediaType === 'movie' ? (
            <>
              {typeof localData.link === 'object' && (
                <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
                  {Object.entries(localData.link)
                    .filter(([key, url], index, arr) => url && arr.findIndex(([k, u]) => u === url) === index)
                    .map(([key, url], index) => {
                      const playerUrl = createPlayerUrl(url);
                      return (
                        <button
                          key={key}
                          onClick={() => handleLinkSelection(url)}
                          style={getButtonStyle(selectedLink === playerUrl || (!selectedLink && index === 0))}
                        >
                          {key.replace('link', '').replace('-', '').toUpperCase() || 'LATINO'}
                        </button>
                      );
                    })
                  }
                </div>
              )}
              {typeof localData.link === 'string' && (
                <button
                  onClick={() => handleLinkSelection(localData.link)}
                  style={getButtonStyle(true)}
                >
                  SERVIDOR
                </button>
              )}
              {selectedLink && (
                <div style={{
                  maxWidth: '1120px',
                  margin: '20px auto',
                  background: '#0f0f0f',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
                  position: 'relative'
                }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #212121, #2c2c2c)',
                    padding: '12px 16px',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff0000' }}></div>
                      <span style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>
                        {tmdbData?.title || tmdbData?.name || 'Reproduciendo'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        background: 'rgba(76, 175, 80, 0.9)',
                        color: '#fff',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '9px',
                        fontWeight: '600'
                      }}>
                        🎬 REPRODUCTOR
                      </div>
                      <div style={{
                        padding: '6px 12px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '20px',
                        color: '#fff',
                        fontSize: '12px'
                      }}>
                        HD
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ position: 'relative', paddingBottom: '56.25%' }}>
                    {iframeError ? (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #1a1a1a, #2d2d2d)',
                        color: '#fff',
                        textAlign: 'center',
                        padding: '20px'
                      }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600' }}>Error de Reproducción</h3>
                        <p style={{ margin: '0 0 20px 0', fontSize: '14px', opacity: '0.8', maxWidth: '400px' }}>
                          No se pudo cargar el reproductor.
                        </p>
                        <button onClick={retryIframe} style={{
                          background: 'linear-gradient(135deg, #8e2de2, #4a00e0)',
                          color: '#fff',
                          border: 'none',
                          padding: '12px 24px',
                          borderRadius: '25px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}>
                          🔄 Reintentar
                        </button>
                      </div>
                    ) : iframeLoading ? (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#000',
                        color: '#fff'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '16px'
                        }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            border: '3px solid #333',
                            borderTop: '3px solid #8e2de2',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }}></div>
                          <span>Cargando...</span>
                        </div>
                      </div>
                    ) : (
                      <iframe
                        key={`movie-${iframeKey}`}
                        ref={iframeRef}
                        src={selectedLink}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          border: 'none'
                        }}
                        allowFullScreen
                        title="Movie Player"
                        onError={handleIframeError}
                        onLoad={handleIframeLoad}
                      ></iframe>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <h3 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '10px' }}>SELECCIONA TEMPORADA</h3>
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '15px' }}>
                {localData.seasons?.map(season => (
                  <button
                    key={season.season_number}
                    onClick={async () => {
                      setActiveSeason(season.season_number);
                      const firstEpisodeLink = season.episodes?.[0]?.link || '';
                      const firstEpisodeNumber = season.episodes?.[0]?.episode_number || 1;
                      if (firstEpisodeLink) {
                        await handleLinkSelection(firstEpisodeLink, firstEpisodeNumber);
                      }
                    }}
                    style={seasonButtonStyle(activeSeason === season.season_number)}
                  >
                    TEMPORADA {season.season_number}
                  </button>
                ))}
              </div>
              {activeSeason && (
                <>
                  <h4 style={{ color: 'white', marginBottom: '10px' }}>EPISODIOS DE TEMPORADA {activeSeason}</h4>
                  <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {localData.seasons
                      ?.find(s => s.season_number === activeSeason)
                      ?.episodes.map(episode => {
                        const isActive = activeEpisode === episode.episode_number;
                        return (
                          <button
                            key={episode.episode_number}
                            onClick={() => {
                              console.log('🔄 Episode clicked:', episode.episode_number);
                              handleLinkSelection(episode.link, episode.episode_number);
                            }}
                            style={episodeButtonStyle(isActive)}
                          >
                            {(episode.title || `Episodio ${episode.episode_number}`).toUpperCase()}
                          </button>
                        );
                      })}
                  </div>
                </>
              )}
              {selectedLink && (
                <div style={{
                  maxWidth: '1120px',
                  margin: '20px auto',
                  background: '#0f0f0f',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
                  position: 'relative'
                }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #212121, #2c2c2c)',
                    padding: '12px 16px',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff0000' }}></div>
                      <span style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>
                        {tmdbData?.name || tmdbData?.title} - T{activeSeason}E{activeEpisode}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        background: 'rgba(76, 175, 80, 0.9)',
                        color: '#fff',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '9px',
                        fontWeight: '600'
                      }}>
                        🎬 REPRODUCTOR
                      </div>
                      <div style={{
                        padding: '6px 12px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '20px',
                        color: '#fff',
                        fontSize: '12px'
                      }}>
                        HD
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ position: 'relative', paddingBottom: '56.25%' }}>
                    {iframeError ? (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #1a1a1a, #2d2d2d)',
                        color: '#fff',
                        textAlign: 'center',
                        padding: '20px'
                      }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600' }}>Error de Reproducción</h3>
                        <button onClick={retryIframe} style={{
                          background: 'linear-gradient(135deg, #8e2de2, #4a00e0)',
                          color: '#fff',
                          border: 'none',
                          padding: '12px 24px',
                          borderRadius: '25px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}>
                          🔄 Reintentar
                        </button>
                      </div>
                    ) : iframeLoading ? (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#000',
                        color: '#fff'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '16px'
                        }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            border: '3px solid #333',
                            borderTop: '3px solid #8e2de2',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }}></div>
                          <span>Cargando...</span>
                        </div>
                      </div>
                    ) : (
                      <iframe
                        key={`series-${iframeKey}-${activeEpisode}`}
                        ref={iframeRef}
                        src={selectedLink}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          border: 'none'
                        }}
                        allowFullScreen
                        title={`Series Player - Episode ${activeEpisode}`}
                        onError={handleIframeError}
                        onLoad={handleIframeLoad}
                      ></iframe>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {error && <p style={{ color: 'red', textAlign: 'center' }}>Error cargando los datos locales.</p>}
      {!localData && !error && !tmdbLoading && (
        <div style={{ color: 'white', textAlign: 'center', padding: '20px' }}>
          <p>No hay enlace disponible para esta película o serie.</p>
          <button 
            onClick={() => fetchLocalData(true)}
            style={{
              background: '#8e2de2',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            🔄 Reintentar
          </button>
        </div>
      )}

      <Similar mediaType={mediaType} id={id} />
      <Recommendation mediaType={mediaType} id={id} />
      <AdBlockerStatus />
    </div>
  );
};

export default Details;
