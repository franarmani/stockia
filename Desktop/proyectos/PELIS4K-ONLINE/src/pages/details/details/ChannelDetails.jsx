import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import ContentWrapper from "../../components/contentWrapper/ContentWrapper";
import Spinner from "../../components/spinner/Spinner";
import "./stylechannel.scss";

// Helper function to load channel data with error handling
const loadChannelData = async () => {
    try {
        const response = await fetch("/channelData.json", {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            cache: 'force-cache'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const json = await response.json();
        return json.channels || [];
    } catch (error) {
        console.warn("Error cargando channelData.json:", error);
        return [];
    }
};

const ChannelDetails = () => {
  const { id } = useParams();
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedServer, setSelectedServer] = useState(1);
  const [iframeError, setIframeError] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const iframeRef = useRef(null);  // Function to return the original URL without modification
  const createPlayerUrl = (originalUrl) => {
    if (!originalUrl) return '';
    // Return the original URL directly - no wrapper
    console.log('📺 Using original channel URL directly:', originalUrl);
    return originalUrl;
  };

  // Handle iframe errors
  const handleIframeError = (e) => {
    console.error('Error cargando canal:', e);
    setIframeError(true);
    setIframeLoading(false);
  };

  const handleIframeLoad = () => {
    console.log('✅ Canal cargado exitosamente');
    setIframeError(false);
    setIframeLoading(false);
    setRetryCount(0);
  };

  const retryIframe = () => {
    if (retryCount < 3) {
      setIframeError(false);
      setIframeLoading(true);
      setRetryCount(prev => prev + 1);
      
      if (iframeRef.current) {
        iframeRef.current.src = '';
        setTimeout(() => {
          if (iframeRef.current) {
            const url = selectedServer === 1 ? channel.iframeUrl : channel.iframeUrl2;
            iframeRef.current.src = createPlayerUrl(url);
          }
        }, 100);
      }
    } else {
      console.log('❌ Máximo de intentos alcanzado');
    }
  };

  const handleServerChange = (serverNumber) => {
    setSelectedServer(serverNumber);
    setIframeError(false);
    setIframeLoading(true);
    setRetryCount(0);
  };

  useEffect(() => {
    const fetchChannelData = async () => {
      setLoading(true);
      setError(null);
      try {
        const channels = await loadChannelData();
        const foundChannel = channels.find((c) => c.id === id);
        setChannel(foundChannel || null);
        if (!foundChannel) {
          setError("Canal no encontrado");
        }
      } catch (error) {
        console.error("Error cargando datos del canal:", error);
        setError("Error cargando el canal. Verifica tu conexión.");
        setChannel(null);
      }
      setLoading(false);
    };

    fetchChannelData();
  }, [id]);

  if (loading) return <Spinner initial={true} />;

  if (!channel) {
    return (
      <ContentWrapper>
        <div className="pageTitle">Canal no encontrado</div>
      </ContentWrapper>
    );
  }

  return (
    <div className="explorePage">
      <div className="channelDetailContainer">
        <h1 className="channelTitle">{channel.name}</h1>
        <div className="channelImageWrapper">
          <img src={channel.image} alt={channel.name} />
        </div>
        
        {/* Server Selection Buttons */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '10px', 
          margin: '20px 0' 
        }}>
          <button
            onClick={() => handleServerChange(1)}
            style={{
              background: selectedServer === 1 
                ? 'linear-gradient(135deg, #8e2de2, #4a00e0)' 
                : '#2c2c2c',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '25px',
              fontWeight: selectedServer === 1 ? 'bold' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: selectedServer === 1 
                ? '0 4px 12px rgba(142,45,226,0.5)' 
                : '0 2px 6px rgba(0,0,0,0.3)',
              textTransform: 'uppercase',
              fontSize: '14px',
              letterSpacing: '1px'
            }}
          >
            🎬 SERVIDOR PRINCIPAL
          </button>
          {channel.iframeUrl2 && (
            <button
              onClick={() => handleServerChange(2)}
              style={{
                background: selectedServer === 2 
                  ? 'linear-gradient(135deg, #8e2de2, #4a00e0)' 
                  : '#2c2c2c',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '25px',
                fontWeight: selectedServer === 2 ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: selectedServer === 2 
                  ? '0 4px 12px rgba(142,45,226,0.5)' 
                  : '0 2px 6px rgba(0,0,0,0.3)',
                textTransform: 'uppercase',
                fontSize: '14px',
                letterSpacing: '1px'
              }}
            >
              📺 SERVIDOR ALTERNATIVO
            </button>
          )}
        </div>

        <p className="channelCategory">
          La transmisión en vivo no es alojada por nosotros. Es posible que tenga publicidad.
        </p>
        
        {/* Floating Player */}
        <div style={{
          maxWidth: '1120px',
          margin: '20px auto',
          background: '#0f0f0f',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
          position: 'relative'
        }}>
          {/* Player Header */}
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
                🔴 {channel.name} - EN VIVO
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{
                background: 'rgba(76, 175, 80, 0.9)',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '9px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                📡 REPRODUCTOR
              </div>
              <div style={{
                padding: '6px 12px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '500'
              }}>
                LIVE HD
              </div>
            </div>
          </div>
          
          {/* Video Container */}
          <div style={{
            position: 'relative',
            paddingBottom: '56.25%', // 16:9 aspect ratio
            height: 0,
            background: '#000'
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
                }}>📡</div>
                <h3 style={{
                  margin: '0 0 12px 0',
                  fontSize: '18px',
                  fontWeight: '600'
                }}>Error de Transmisión</h3>
                <p style={{
                  margin: '0 0 20px 0',
                  fontSize: '14px',
                  opacity: '0.8',
                  maxWidth: '400px'
                }}>
                  No se pudo cargar la transmisión en vivo. Esto puede deberse a restricciones del servidor o problemas de conectividad.
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
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
                  {channel.iframeUrl2 && selectedServer === 1 && (
                    <button
                      onClick={() => handleServerChange(2)}
                      style={{
                        background: 'linear-gradient(135deg, #ff6b35, #f7931e)',
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
                      📺 Servidor Alternativo
                    </button>
                  )}
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
                  <span>Conectando transmisión en vivo...</span>
                </div>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                src={createPlayerUrl(selectedServer === 1 ? channel.iframeUrl : channel.iframeUrl2)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none'
                }}
                allowFullScreen
                title={`${channel.name} - Servidor ${selectedServer}`}
                onError={handleIframeError}
                onLoad={handleIframeLoad}
              ></iframe>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelDetails;
