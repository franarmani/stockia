import React, { useEffect, useState } from "react";
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

  // Function to open channel player in new tab
  const openChannelPlayer = () => {
    if (!channel) return;
    
    try {
      // Encode channel data to pass via URL
      const channelData = encodeURIComponent(JSON.stringify(channel));
      
      // Get current origin to build absolute URL
      const currentOrigin = window.location.origin;
      const playerUrl = `${currentOrigin}/channel-player/${channel.id}?channelData=${channelData}`;
      
      console.log('Opening player URL:', playerUrl);
      
      // Open in new tab with specific features
      const newWindow = window.open(
        playerUrl,
        `channel-player-${channel.id}`,
        'width=1280,height=800,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=yes,menubar=yes'
      );
      
      if (newWindow) {
        newWindow.focus();
        console.log('Player window opened successfully');
      } else {
        console.error('Failed to open window - popup blocked?');
        alert('Por favor, permite ventanas emergentes para abrir el reproductor de captura');
      }
    } catch (error) {
      console.error('Error opening channel player:', error);
      alert('Error al abrir el reproductor. Inténtalo de nuevo.');
    }
  };

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
        <p className="channelCategory">
          La transmisión en vivo no es alojada por nosotros. Es posible que tenga publicidad.
        </p>
        
        {/* Botón para abrir reproductor en nueva pestaña */}
        <div className="playerActions">
          <button onClick={openChannelPlayer} className="openPlayerBtn">
            <span className="btn-icon">🎬</span>
            <div className="btn-content">
              <span className="btn-title">Reproductor de Captura</span>
              <span className="btn-subtitle">Nueva pestaña - Evita restricciones</span>
            </div>
          </button>
          <p className="playerInfo">
            <strong>🚀 ¿Por qué usar el reproductor de captura?</strong><br/>
            Los canales de TV bloquean la reproducción en iframes por restricciones de copyright. 
            Nuestro reproductor simula una <strong>captura de pantalla en tiempo real</strong>, 
            mostrando exactamente lo que muestra el canal oficial sin retrasmitir contenido.
            <br/><br/>
            <span className="features">
              ✅ Sin restricciones de iframe<br/>
              ✅ Pantalla completa disponible<br/>
              ✅ Interfaz de grabación profesional<br/>
              ✅ Indicadores de transmisión en vivo
            </span>
          </p>
        </div>

        <div className="iframeWrapper">
          <iframe src={channel.iframeUrl} allowFullScreen title="Canal Principal"></iframe>
          {channel.iframeUrl2 && (
            <iframe src={channel.iframeUrl2} allowFullScreen title="Canal Alternativo"></iframe>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChannelDetails;
