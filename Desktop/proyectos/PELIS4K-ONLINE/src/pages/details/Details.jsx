import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import useFetch from './../../hooks/useFetch';
import { loadLocalData } from '../../utils/localDataService';
import { fetchDataFromApi } from '../../utils/api';
import DetailsBanner from './detailsBanner/DetailsBanner';
import Cast from './cast/Cast';
import VideosSection from './videosSection/VideosSection';
import Similar from './carousels/Similar';
import Recommendation from './carousels/Recommendations';
import AdBlockerStatus from '../../components/adBlockerStatus/AdBlockerStatus';
import './style.scss'; // Importar los nuevos estilos

const Details = () => {
  const { mediaType, id } = useParams();
  const { data: tmdbData, loading: tmdbLoading } = useFetch(`/${mediaType}/${id}`);
  const { data: credits, loading: creditsLoading } = useFetch(`/${mediaType}/${id}/credits`);
  const [localData, setLocalData] = useState(null);
  const [error, setError] = useState(false);
  const [selectedLink, setSelectedLink] = useState('');
  const [activeSeason, setActiveSeason] = useState(null);
  const [iframeError, setIframeError] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [nextEpisodeInfo, setNextEpisodeInfo] = useState(null);
  
  // Simple iframe refs without protection (for debugging)
  const iframeRef = useRef(null);
  const containerRef = useRef(null);

  // Función para obtener información del próximo episodio
  const fetchNextEpisodeInfo = async () => {
    if (mediaType !== 'tv' && mediaType !== 'series') return;
    
    try {
      // Obtener detalles completos de la serie incluyendo próximo episodio
      const seriesDetails = await fetchDataFromApi(`/tv/${id}`);
      
      if (seriesDetails) {
        const {
          next_episode_to_air,
          last_episode_to_air,
          number_of_seasons,
          seasons,
          status
        } = seriesDetails;

        let nextInfo = null;

        if (next_episode_to_air) {
          // Hay un próximo episodio programado
          nextInfo = {
            type: 'episode',
            title: next_episode_to_air.name || `Episodio ${next_episode_to_air.episode_number}`,
            air_date: next_episode_to_air.air_date,
            season_number: next_episode_to_air.season_number,
            episode_number: next_episode_to_air.episode_number,
            overview: next_episode_to_air.overview
          };
        } else if (status === 'Returning Series' || status === 'In Production') {
          // La serie continúa pero no hay fecha específica del próximo episodio
          nextInfo = {
            type: 'season',
            title: `Temporada ${number_of_seasons + 1}`,
            status: status,
            message: 'Próxima temporada en producción'
          };
        } else if (status === 'Ended') {
          nextInfo = {
            type: 'ended',
            message: 'Serie finalizada'
          };
        }

        setNextEpisodeInfo(nextInfo);
      }
    } catch (error) {
      console.log('Error obteniendo info del próximo episodio:', error);
      setNextEpisodeInfo(null);
    }
  };

  useEffect(() => {
    const fetchLocalData = async () => {
      setError(false);
      try {
        const data = await loadLocalData();
        
        let found = null;
        if (mediaType === 'movie') {
          found = data.movies?.find(movie => movie.id.toString() === id);
        } else if (mediaType === 'tv' || mediaType === 'series') {
          found = data.series?.find(serie => serie.id.toString() === id);
        }

        setLocalData(found || null);

        if (found) {
          if (mediaType === 'movie') {
            const firstLink = typeof found.link === 'object'
              ? Object.values(found.link).find(url => url)
              : found.link;
            setSelectedLink(firstLink);
          } else if (mediaType === 'tv' || mediaType === 'series') {
            const firstSeason = found.seasons?.[0];
            setActiveSeason(firstSeason?.season_number);
            const firstEpisode = firstSeason?.episodes?.[0];
            if (firstEpisode) setSelectedLink(firstEpisode.link);
          }
        }

      } catch (error) {
        console.error('Error cargando datos locales:', error);
        setError(true);
      }
    };

    fetchLocalData();
  }, [mediaType, id]);

  // useEffect para obtener información del próximo episodio
  useEffect(() => {
    if (!tmdbLoading && tmdbData && (mediaType === 'tv' || mediaType === 'series')) {
      fetchNextEpisodeInfo();
    }
  }, [tmdbData, tmdbLoading, mediaType, id]);

  const getButtonStyle = (isActive) => ({
    background: isActive
      ? 'linear-gradient(135deg, #8e2de2, #4a00e0)'
      : '#2c2c2c',
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

  // Handle iframe errors
  const handleIframeError = (e) => {
    console.error('Error 232011 - iframe failed to load:', e);
    console.log('Attempted URL:', selectedLink);
    setIframeError(true);
    setIframeLoading(false);
  };

  const handleIframeLoad = () => {
    console.log('✅ Iframe loaded successfully:', selectedLink);
    setIframeError(false);
    setIframeLoading(false);
    setRetryCount(0);
  };

  // Función para forzar la carga del iframe
  const forceIframeReload = () => {
    console.log('🔄 Forzando recarga del iframe');
    if (iframeRef.current && selectedLink) {
      setIframeLoading(true);
      setIframeError(false);
      
      // Limpiar y recargar
      iframeRef.current.src = '';
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = selectedLink;
        }
      }, 200);
      
      // Timeout de seguridad
      setTimeout(() => {
        setIframeLoading(false);
      }, 6000);
    }
  };

  const handleLinkSelection = (link) => {
    console.log('🎬 Seleccionando nuevo episodio:', link);
    setSelectedLink(link);
    setIframeError(false);
    setIframeLoading(true);
    setRetryCount(0);
    
    // Timeout de seguridad para evitar loading infinito
    setTimeout(() => {
      setIframeLoading(false);
    }, 8000); // 8 segundos máximo de loading
  };

  const retryIframe = () => {
    if (retryCount < 3) {
      setIframeError(false);
      setIframeLoading(true);
      setRetryCount(prev => prev + 1);
      
      // Force iframe reload by changing src
      if (iframeRef.current) {
        iframeRef.current.src = '';
        setTimeout(() => {
          if (iframeRef.current) {
            iframeRef.current.src = selectedLink;
          }
        }, 100);
      }
    } else {
      console.log('❌ Maximum retry attempts reached');
    }
  };

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

  // useEffect para manejar cambios de selectedLink
  useEffect(() => {
    if (selectedLink && iframeRef.current) {
      console.log('🔄 Link cambiado, reiniciando estados');
      setIframeError(false);
      setIframeLoading(true);
      
      // Timeout de seguridad más corto
      const loadingTimeout = setTimeout(() => {
        console.log('⏰ Timeout alcanzado, ocultando loading');
        setIframeLoading(false);
      }, 5000);
      
      return () => clearTimeout(loadingTimeout);
    }
  }, [selectedLink]);

  // useEffect para obtener información del próximo episodio
  useEffect(() => {
    fetchNextEpisodeInfo();
  }, [mediaType, id]);

  return (
    <div className="detailsPage">
      {!tmdbLoading && tmdbData && (
        <>
          <DetailsBanner data={tmdbData} crew={credits?.crew} />
          <Cast data={credits?.cast} loading={creditsLoading} />
          <VideosSection data={tmdbData?.videos} loading={tmdbLoading} />
        </>
      )}

      {localData && (
        <div style={{ padding: '20px', textAlign: 'center'  }}>
         
          {mediaType === 'movie' ? (
            <>
              {/* Sección mejorada de servidores */}
              <div className="servers-container">
                <h3 className="servers-title">Selecciona un Servidor</h3>
                <div className="servers-grid">
                  {typeof localData.link === 'object' ? (
                    Object.entries(localData.link)
                      .filter(([key, url], index, arr) => url && arr.findIndex(([k, u]) => u === url) === index)
                      .map(([key, url], index) => (
                        <button
                          key={key}
                          className={`server-button ${selectedLink === url || (!selectedLink && index === 0) ? 'active' : ''}`}
                          onClick={() => handleLinkSelection(url)}
                          data-server={key}
                        >
                          <span>{
                            key === 'link' ? 'LATINO' :
                            key.replace('link', '').replace('-', '').toUpperCase() === 'SERVIRO' ? 'LATINO' : 
                            key.replace('link', '').replace('-', '').toUpperCase() || 'SERVIDOR'
                          }</span>
                          <small style={{ display: 'block', fontSize: '10px', opacity: 0.8, marginTop: '4px' }}>
                            Servidor {index + 1}
                          </small>
                        </button>
                      ))
                  ) : typeof localData.link === 'string' ? (
                    <button
                      className={`server-button ${selectedLink === localData.link ? 'active' : ''}`}
                      onClick={() => handleLinkSelection(localData.link)}
                    >
                      <span>SERVIDOR PRINCIPAL</span>
                    </button>
                  ) : null}
                </div>
              </div>
              {selectedLink && (
                <div className="player-container" ref={containerRef}>
                  {/* Player Header */}
                  <div className="player-header">
                    <div className="header-left">
                      <div className="live-indicator"></div>
                      <span className="title">
                        {tmdbData?.title || tmdbData?.name || 'Reproduciendo'}
                      </span>
                    </div>
                    <div className="header-right">
                      
                      <div className="quality-badge">
                        HD
                      </div>
                    </div>
                  </div>
                  
                  {/* Video Container */}
                  <div style={{
                    position: 'relative',
                    paddingBottom: '56.25%' // 16:9 aspect ratio
                  }}>
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
                        <div style={{
                          fontSize: '48px',
                          marginBottom: '16px'
                        }}>⚠️</div>
                        <h3 style={{
                          margin: '0 0 12px 0',
                          fontSize: '18px',
                          fontWeight: '600'
                        }}>Error de Reproducción</h3>
                        <p style={{
                          margin: '0 0 20px 0',
                          fontSize: '14px',
                          opacity: '0.8',
                          maxWidth: '400px'
                        }}>
                          No se pudo cargar el video (Error 232011). Esto puede deberse a restricciones del servidor o problemas de conectividad.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button
                            onClick={retryIframe}
                            style={{
                              background: 'linear-gradient(135deg, #8e2de2, #4a00e0)',
                              color: '#fff',
                              border: 'none',
                              padding: '12px 24px',
                              borderRadius: '25px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              fontSize: '14px',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            🔄 Reintentar
                          </button>
                          {retryCount > 0 && (
                            <span style={{
                              padding: '12px',
                              color: '#ffa500',
                              fontSize: '12px'
                            }}>
                              Intentos: {retryCount}/3
                            </span>
                          )}
                        </div>
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
                          <span>Cargando película...</span>
                          <button
                            onClick={forceIframeReload}
                            style={{
                              background: '#ed30ff',
                              color: '#fff',
                              border: 'none',
                              padding: '8px 16px',
                              borderRadius: '20px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              fontSize: '12px',
                              marginTop: '8px'
                            }}
                          >
                            Forzar carga
                          </button>
                        </div>
                      </div>
                    ) : (
                      <iframe
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
              {/* Sección mejorada de temporadas y episodios */}
              <div className="seasons-episodes-container">
                <h3 className="seasons-title">Selecciona Temporada</h3>
                
                <div className="seasons-grid">
                  {localData.seasons?.map(season => (
                    <button
                      key={season.season_number}
                      className={`season-button ${activeSeason === season.season_number ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveSeason(season.season_number);
                        const firstEpisodeLink = season.episodes?.[0]?.link;
                        if (firstEpisodeLink) {
                          handleLinkSelection(firstEpisodeLink);
                        }
                      }}
                      data-season={`TEMPORADA ${season.season_number}`}
                    >
                      TEMPORADA {season.season_number}
                    </button>
                  ))}
                </div>
                {activeSeason && (
                  <>
                    <h4 className="episodes-title">Episodios de Temporada {activeSeason}</h4>
                    <div className="episodes-grid">
                      {localData.seasons
                        ?.find(s => s.season_number === activeSeason)
                        ?.episodes.map(episode => (
                          <button
                            key={episode.episode_number}
                            className={`episode-button episode-circle ${selectedLink === episode.link ? 'active' : ''}`}
                            onClick={() => handleLinkSelection(episode.link)}
                            title={episode.title || `Episodio ${episode.episode_number}`}
                          >
                            {episode.episode_number}
                          </button>
                        ))}
                    </div>
                  </>
                )}
                
                {/* Información del próximo episodio - debajo de episodios */}
                {nextEpisodeInfo && (
                  <div className="next-episode-simple">
                    {nextEpisodeInfo.type === 'episode' && (
                      <div className="next-info">
                        <span className="next-label">Próximo episodio:</span>
                        <span className="next-title">{nextEpisodeInfo.title}</span>
                        <span className="next-date">
                          {new Date(nextEpisodeInfo.air_date).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    )}
                    
                    {nextEpisodeInfo.type === 'season' && (
                      <div className="next-info">
                        <span className="next-label">Próxima temporada en producción</span>
                      </div>
                    )}
                    
                    {nextEpisodeInfo.type === 'ended' && (
                      <div className="next-info ended">
                        <span className="next-label">Serie finalizada</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {selectedLink && (
                <div 
                  ref={containerRef}
                  style={{
                    maxWidth: '1120px',
                    margin: '20px auto',
                    background: '#0f0f0f',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
                    position: 'relative'
                  }}
                >
                 

                  {/* Video Player Header */}
                  <div style={{
                    background: 'linear-gradient(135deg, #212121, #2c2c2c)',
                    padding: '12px 16px',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#ff0000'
                      }}></div>
                      <span style={{
                        color: '#fff',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}>
                        {tmdbData?.name || tmdbData?.title} - T{activeSeason}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{
                        padding: '6px 12px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '20px',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        HD
                      </div>
                    </div>
                  </div>
                  
                  {/* Video Container */}
                  <div style={{
                    position: 'relative',
                    paddingBottom: '56.25%' // 16:9 aspect ratio
                  }}>
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
                        <div style={{
                          fontSize: '48px',
                          marginBottom: '16px'
                        }}>⚠️</div>
                        <h3 style={{
                          margin: '0 0 12px 0',
                          fontSize: '18px',
                          fontWeight: '600'
                        }}>Error de Reproducción</h3>
                        <p style={{
                          margin: '0 0 20px 0',
                          fontSize: '14px',
                          opacity: '0.8',
                          maxWidth: '400px'
                        }}>
                          No se pudo cargar el video (Error 232011). Esto puede deberse a restricciones del servidor o problemas de conectividad.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button
                            onClick={retryIframe}
                            style={{
                              background: 'linear-gradient(135deg, #8e2de2, #4a00e0)',
                              color: '#fff',
                              border: 'none',
                              padding: '12px 24px',
                              borderRadius: '25px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              fontSize: '14px',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            🔄 Reintentar
                          </button>
                          {retryCount > 0 && (
                            <span style={{
                              padding: '12px',
                              color: '#ffa500',
                              fontSize: '12px'
                            }}>
                              Intentos: {retryCount}/3
                            </span>
                          )}
                        </div>
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
                          <span>Cargando episodio...</span>
                          <button
                            onClick={forceIframeReload}
                            style={{
                              background: '#ed30ff',
                              color: '#fff',
                              border: 'none',
                              padding: '8px 16px',
                              borderRadius: '20px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              fontSize: '12px',
                              marginTop: '8px'
                            }}
                          >
                            Forzar carga
                          </button>
                        </div>
                      </div>
                    ) : (
                      <iframe
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
                        title="Series Player"
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
        <p style={{ color: 'white', textAlign: 'center' }}>No hay enlace disponible para esta película o serie.</p>
      )}

      {nextEpisodeInfo && (
        <div className="next-episode-info" style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '16px',
          borderRadius: '8px',
          margin: '20px 0',
          color: '#fff',
          textAlign: 'center',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}>
          {nextEpisodeInfo.type === 'episode' && (
            <>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '500' }}>
                Próximo Episodio
              </h4>
              <p style={{ margin: '0', fontSize: '14px', opacity: 0.9 }}>
                {nextEpisodeInfo.title} - S{nextEpisodeInfo.season_number}E{nextEpisodeInfo.episode_number}
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.7 }}>
                {nextEpisodeInfo.air_date ? `Fecha de estreno: ${new Date(nextEpisodeInfo.air_date).toLocaleDateString('es-ES')}` : 'Fecha de estreno: TBD'}
              </p>
            </>
          )}
          {nextEpisodeInfo.type === 'season' && (
            <>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '500' }}>
                Próxima Temporada
              </h4>
              <p style={{ margin: '0', fontSize: '14px', opacity: 0.9 }}>
                {nextEpisodeInfo.title}
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.7 }}>
                {nextEpisodeInfo.message}
              </p>
            </>
          )}
          {nextEpisodeInfo.type === 'ended' && (
            <p style={{ margin: '0', fontSize: '14px', opacity: 0.9 }}>
              Esta serie ha finalizado.
            </p>
          )}
        </div>
      )}

      <Similar mediaType={mediaType} id={id} />
      <Recommendation mediaType={mediaType} id={id} />
      
      {/* Ad Blocker Status Component */}
      <AdBlockerStatus />
    </div>
  );
};

export default Details;
