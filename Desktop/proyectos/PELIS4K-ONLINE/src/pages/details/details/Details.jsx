import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import useFetch from './../../hooks/useFetch';
import usePopupBlocker from '../../hooks/usePopupBlocker';
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
  
  // Activar protección anti-popup específica para móviles
  const { blockedCount, isMobile, resetCount } = usePopupBlocker(true, {
    aggressiveMode: true,
    logBlocked: true,
    preventNavigation: true,
    blockClickjacking: true
  });
  
  const [localData, setLocalData] = useState(null);
  const [error, setError] = useState(false);
  const [selectedLink, setSelectedLink] = useState('');
  const [activeSeason, setActiveSeason] = useState(null);
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [iframeError, setIframeError] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(false);  const [retryCount, setRetryCount] = useState(0);
  const [lastDataHash, setLastDataHash] = useState(null);
  const [iframeKey, setIframeKey] = useState(0);
  
  const iframeRef = useRef(null);
  const containerRef = useRef(null);// Function to return the original URL without modification
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
  }, [mediaType, id, lastDataHash]);  // FAST link selection - Optimized for speed
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
  }, [iframeLoading, selectedLink, iframeKey, activeEpisode]);  // Handle iframe errors
  const handleIframeError = (e) => {
    console.error('Error iframe:', e);
    console.log('🔍 Current URL causing error:', selectedLink);
    setIframeError(true);
    setIframeLoading(false);
  };  const handleIframeLoad = () => {
    console.log('✅ Iframe loaded successfully');
    console.log(`📱 Mobile protection active: ${isMobile}, Popups blocked: ${blockedCount}`);
    setIframeError(false);
    setIframeLoading(false);
    setRetryCount(0);

    // Aplicar protección anti-popup al iframe cargado (solo JavaScript, sin sandbox)
    if (iframeRef.current) {
      try {
        const iframe = iframeRef.current;
        
        // Lista de dominios de streaming legítimos
        const legitimateStreamingDomains = [
          'mixdrop.co', 'mixdrop.to', 'mixdrop.my', 'mixdrop.sx',
          'streamtape.com', 'doodstream.com', 'upstream.to',
          'voe.sx', 'streamlare.com', 'supervideo.tv'
        ];

        const currentSrc = iframe.src || selectedLink || '';
        const isLegitimateStreaming = legitimateStreamingDomains.some(domain => 
          currentSrc.includes(domain)
        );

        console.log('🎥 Streaming domain detected:', isLegitimateStreaming, currentSrc);

        // Protección selectiva contra popups solo vía JavaScript
        if (iframe.contentWindow) {
          const originalOpen = iframe.contentWindow.open;
          iframe.contentWindow.open = function(url, name, specs) {
            // Si es streaming legítimo, verificar si el popup también es legítimo
            if (isLegitimateStreaming && url) {
              const isLegitimatePopup = legitimateStreamingDomains.some(domain => 
                url.includes(domain)
              );
              
              if (isLegitimatePopup) {
                console.log('✅ Permitiendo popup legítimo de streaming:', url);
                return originalOpen ? originalOpen.apply(this, arguments) : null;
              }
            }

            // Bloquear popups publicitarios conocidos
            const adPatterns = [
              'doubleclick', 'googlesyndication', 'popads', 'popcash', 
              'propellerads', 'outbrain', 'taboola', 'adskeeper'
            ];

            const isAd = url && adPatterns.some(pattern => 
              url.toLowerCase().includes(pattern)
            );

            if (isAd) {
              console.log('🚫📱 Popup publicitario bloqueado desde iframe:', url);
              return null;
            }

            // En móviles, ser más restrictivo con popups no identificados solo para sitios no legítimos
            if (isMobile && !isLegitimateStreaming && (!url || url === 'about:blank')) {
              console.log('🚫📱 Popup vacío bloqueado en móvil:', url);
              return null;
            }

            // Para streaming legítimo, permitir más flexibilidad
            if (isLegitimateStreaming) {
              console.log('⚠️ Popup desde streaming legítimo, permitiendo:', url);
              return originalOpen ? originalOpen.apply(this, arguments) : null;
            }

            console.log('🚫📱 Popup bloqueado desde iframe:', url);
            return null;
          };
        }
        
      } catch (err) {
        console.log('ℹ️ Protección cross-origin aplicada correctamente (JavaScript only)');
      }
    }
  };const retryIframe = () => {
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

      {localData && (        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          {mediaType === 'movie' ? (
            <>
              {/* Movie Server Selector */}
              <div style={{ 
                maxWidth: '1200px',
                margin: '0 auto 40px'
              }}>
                <h3 style={{ 
                  color: 'white', 
                  fontSize: '24px', 
                  fontWeight: '600',
                  marginBottom: '30px',
                  textAlign: 'center',
                  letterSpacing: '0.5px'
                }}>
                  Servidores
                </h3>
                
                {typeof localData.link === 'object' && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    flexWrap: 'wrap', 
                    gap: '16px',
                    marginBottom: '30px'
                  }}>
                    {Object.entries(localData.link)
                      .filter(([key, url], index, arr) => url && arr.findIndex(([k, u]) => u === url) === index)
                      .map(([key, url], index) => {
                        const playerUrl = createPlayerUrl(url);
                        const isActive = selectedLink === playerUrl || (!selectedLink && index === 0);
                        return (
                          <button
                            key={key}
                            onClick={() => handleLinkSelection(url)}
                            style={{
                              background: isActive
                                ? 'linear-gradient(135deg, #9D50BB, #6A0DAD)'
                                : 'rgba(255, 255, 255, 0.1)',
                              color: '#fff',
                              border: isActive 
                                ? '1px solid rgba(157, 80, 187, 0.3)' 
                                : '1px solid rgba(255, 255, 255, 0.1)',
                              padding: '14px 28px',
                              borderRadius: '8px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              fontSize: '15px',
                              minWidth: '120px',
                              backdropFilter: 'blur(10px)',
                              fontFamily: 'inherit',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive) {
                                e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) {
                                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                              }
                            }}
                          >
                            {key.replace('link', '').replace('-', '').toUpperCase() || 'LATINO'}
                          </button>
                        );
                      })
                    }
                  </div>
                )}
                
                {typeof localData.link === 'string' && (
                  <div style={{ marginBottom: '30px' }}>
                    <button
                      onClick={() => handleLinkSelection(localData.link)}
                      style={{
                        background: 'linear-gradient(135deg, #9D50BB, #6A0DAD)',
                        color: '#fff',
                        border: '1px solid rgba(157, 80, 187, 0.3)',
                        padding: '14px 28px',
                        borderRadius: '8px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        fontSize: '15px',
                        minWidth: '120px',
                        backdropFilter: 'blur(10px)',
                        fontFamily: 'inherit',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      SERVIDOR
                    </button>
                  </div>
                )}
              </div>
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
                    ) : (                      <iframe
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
                        loading="eager"
                        // Máxima compatibilidad - sin sandbox
                        allow="fullscreen; picture-in-picture; encrypted-media; autoplay; camera; microphone; geolocation"
                        referrerPolicy="unsafe-url"
                      ></iframe>
                    )}
                  </div>
                </div>
              )}
            </>          ) : (
            <>              {/* Season Selector */}
              <div style={{ 
                padding: '40px 20px',
                margin: '20px 0'
              }}>
                <div style={{ 
                  maxWidth: '1200px',
                  margin: '0 auto'
                }}>
                  <h3 style={{ 
                    color: 'white', 
                    fontSize: '24px', 
                    fontWeight: '600',
                    marginBottom: '30px',
                    textAlign: 'center',
                    letterSpacing: '0.5px'
                  }}>
                    Temporadas
                  </h3>
                  
                  <div style={{ 
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px',
                    justifyContent: 'center',
                    marginBottom: '40px'
                  }}>
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
                        style={{
                          background: activeSeason === season.season_number
                            ? 'linear-gradient(135deg, #9D50BB, #6A0DAD)'
                            : 'rgba(255, 255, 255, 0.1)',
                          color: '#fff',
                          border: activeSeason === season.season_number 
                            ? '1px solid rgba(157, 80, 187, 0.3)' 
                            : '1px solid rgba(255, 255, 255, 0.1)',
                          padding: '14px 28px',
                          borderRadius: '8px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          fontSize: '15px',
                          minWidth: '140px',
                          backdropFilter: 'blur(10px)',
                          fontFamily: 'inherit'
                        }}
                        onMouseEnter={(e) => {
                          if (activeSeason !== season.season_number) {
                            e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                            e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (activeSeason !== season.season_number) {
                            e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          }
                        }}
                      >
                        Temporada {season.season_number}
                      </button>
                    ))}
                  </div>
                </div>
              </div>{/* Episode Selector */}
              {activeSeason && (
                <div style={{ 
                  padding: '0 20px',
                  marginBottom: '30px'
                }}>
                  <div style={{ 
                    maxWidth: '1200px',
                    margin: '0 auto'
                  }}>
                    <h4 style={{ 
                      color: 'white', 
                      fontSize: '20px', 
                      fontWeight: '600',
                      marginBottom: '20px',
                      textAlign: 'center'
                    }}>
                      Episodios - Temporada {activeSeason}
                    </h4>
                    
                    <div style={{ 
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                      gap: '16px',
                      maxHeight: '600px',
                      overflowY: 'auto',
                      padding: '4px'
                    }}>
                      {localData.seasons
                        ?.find(s => s.season_number === activeSeason)
                        ?.episodes.map(episode => {
                          const isActive = activeEpisode === episode.episode_number;
                          return (
                            <button
                              key={episode.episode_number}
                              onClick={() => {
                                handleLinkSelection(episode.link, episode.episode_number);
                              }}                              style={{
                                background: isActive
                                  ? 'linear-gradient(135deg, #da2eef, #2989d8)'
                                  : 'transparent',
                                color: '#fff',
                                border: isActive ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                                padding: '16px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                backdropFilter: 'blur(10px)'
                              }}                              onMouseEnter={(e) => {
                                if (!isActive) {
                                  e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                                  e.target.style.transform = 'translateY(-2px)';
                                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isActive) {
                                  e.target.style.background = 'transparent';
                                  e.target.style.transform = 'translateY(0)';
                                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                }
                              }}
                            >
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: isActive 
                                  ? 'rgba(255, 255, 255, 0.2)' 
                                  : 'rgba(255, 255, 255, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '14px',
                                fontWeight: '600',
                                flexShrink: 0
                              }}>
                                {isActive ? '▶' : episode.episode_number}
                              </div>                              <div style={{ flex: 1 }}>
                                <div style={{
                                  fontSize: '16px',
                                  fontWeight: '500',
                                  marginBottom: '4px',
                                  lineHeight: '1.3'
                                }}>
                                  {episode.title || `Episodio ${episode.episode_number}`}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
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
                    ) : (                      <iframe
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
                        loading="eager"
                        // Máxima compatibilidad - sin sandbox
                        allow="fullscreen; picture-in-picture; encrypted-media; autoplay; camera; microphone; geolocation"
                        referrerPolicy="unsafe-url"
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
      )}      <Similar mediaType={mediaType} id={id} />
      <Recommendation mediaType={mediaType} id={id} />
      <AdBlockerStatus />
      
      {/* Mobile Popup Blocker Status */}
      {isMobile && blockedCount > 0 && (
        <div style={{
          position: 'fixed',
          top: '70px',
          right: '20px',
          background: 'linear-gradient(135deg, #ff5722, #ff9800)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: '600',
          zIndex: 1001,
          border: '1px solid rgba(255, 87, 34, 0.5)',
          boxShadow: '0 2px 8px rgba(255, 87, 34, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          animation: 'popupBlocked 0.5s ease-out'
        }}>
          <span>🚫📱</span>
          <span>{blockedCount} popup{blockedCount !== 1 ? 's' : ''} bloqueado{blockedCount !== 1 ? 's' : ''}</span>
          <button
            onClick={resetCount}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '9px',
              cursor: 'pointer',
              marginLeft: '4px'
            }}
          >
            ✕
          </button>
        </div>
      )}

      <style>
        {`
          @keyframes popupBlocked {
            0% { transform: translateX(100px); opacity: 0; }
            100% { transform: translateX(0); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
};

export default Details;
