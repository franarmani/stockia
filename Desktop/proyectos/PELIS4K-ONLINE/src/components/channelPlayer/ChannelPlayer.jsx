import React, { useEffect, useState, useRef } from 'react';
import CustomCursor from '../customCursor/CustomCursor';
import './style.scss';

const ChannelPlayer = ({ channel, onClose, onNavigateBack, eventData, servers }) => {
  // Validación temprana para evitar errores
  if (!channel && !eventData) {
    return (
      <div className="channel-player-container">
        <div style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1b0624, #4a0d63)',
          color: 'white',
          fontFamily: 'Segoe UI, sans-serif'
        }}>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h2>Error</h2>
            <p>No se encontraron datos del canal</p>
            <button 
              onClick={() => window.history.back()}
              style={{
                background: 'linear-gradient(45deg, #9D50BB, #ed30ff)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '25px',
                cursor: 'pointer',
                marginTop: '20px'
              }}
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedServer, setSelectedServer] = useState(0);
  const [showServerOptions, setShowServerOptions] = useState(false);
  const playerRef = useRef(null);
  const intervalRef = useRef(null);

  // Determinar si tenemos múltiples servidores
  const availableServers = servers || (channel ? [channel] : []);
  const currentChannel = availableServers[selectedServer] || channel;

  useEffect(() => {
    // Simular grabación en tiempo real
    intervalRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };  const handleClosePlayer = () => {
    // Ir hacia atrás en el historial del navegador
    window.history.back();
  };
  return (
    <div className="channel-player-container" ref={playerRef}>
      <CustomCursor />
      
      {/* Header con controles de grabación */}
      <div className="player-header">
        <div className="recording-indicator">
          <div className="rec-dot"></div>
          <span>EN VIVO - {formatTime(recordingTime)}</span>
        </div>        <div className="channel-info">
          <span className="channel-name">
            {eventData ? 
              `${eventData.name || eventData.teams?.join(' vs ') || 'Evento Deportivo'}` : 
              (currentChannel?.name || 'Canal Desconocido')
            }
          </span>
          {eventData && (
            <span className="event-details">
              {eventData.sport} • {eventData.time}
            </span>
          )}
        </div>
        <div className="player-controls">
          {availableServers.length > 1 && (
            <button 
              onClick={() => setShowServerOptions(!showServerOptions)} 
              className="control-btn server-btn"
              title="Cambiar servidor"
            >
              📺 {selectedServer + 1}/{availableServers.length}
            </button>
          )}
          <button onClick={toggleFullscreen} className="control-btn">
            {isFullscreen ? '⚬' : '⛶'}
          </button>
          <button onClick={handleClosePlayer} className="control-btn close-btn">
            ✕
          </button>
        </div>
      </div>

      {/* Panel de opciones de servidores */}
      {showServerOptions && availableServers.length > 1 && (
        <div className="server-options-panel">
          <div className="server-options-header">
            <h3>Seleccionar Servidor</h3>
            <button 
              onClick={() => setShowServerOptions(false)}
              className="close-options-btn"
            >
              ✕
            </button>
          </div>
          <div className="server-options-list">
            {availableServers.map((server, index) => (
              <button
                key={index}
                className={`server-option ${selectedServer === index ? 'active' : ''} ${server.status !== 'online' ? 'offline' : ''}`}
                onClick={() => {
                  if (server.status === 'online') {
                    setSelectedServer(index);
                    setShowServerOptions(false);
                  }
                }}
                disabled={server.status !== 'online'}
              >
                <div className="server-info">
                  <span className="server-name">{server.name || `Servidor ${index + 1}`}</span>
                  <span className="server-quality">{server.quality?.toUpperCase() || 'HD'}</span>
                </div>                <div className="server-status">
                  <div className={`status-indicator ${server.status === 'online' ? 'online' : 'offline'}`}></div>
                  <span className={`status-text ${server.status === 'online' ? 'online' : 'offline'}`}>
                    {server.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}{/* Área del reproductor */}
      <div className="player-content">        <div className="iframe-container">
          <iframe 
            src={currentChannel?.iframeUrl || currentChannel?.url || ''} 
            allowFullScreen 
            title={`${currentChannel?.name || 'Canal'} - Transmisión en vivo`}
            allow="autoplay; encrypted-media; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
            referrerPolicy="no-referrer-when-downgrade"
          />
          
          {/* Overlay de "grabación" */}
          <div className="recording-overlay">
            <div className="screen-indicator">
              <div className="indicator-corner top-left"></div>
              <div className="indicator-corner top-right"></div>
              <div className="indicator-corner bottom-left"></div>
              <div className="indicator-corner bottom-right"></div>
            </div>
            
            {/* Mensaje de captura */}
            <div className="capture-message">
              <span>📹 CAPTURANDO PANTALLA</span>
            </div>
          </div>
        </div>        {/* Canal alternativo si existe */}
        {currentChannel?.iframeUrl2 && (
          <div className="alternative-stream">
            <h3>Señal Alternativa</h3>
            <div className="iframe-container">
              <iframe 
                src={currentChannel.iframeUrl2} 
                allowFullScreen 
                title={`${currentChannel?.name || 'Canal'} - Señal alternativa`}
                allow="autoplay; encrypted-media; fullscreen"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        )}
      </div>      {/* Footer con información */}
      <div className="player-footer">
        <div className="stream-info">
          <span>📡 Transmisión en directo</span>
          <span>🔴 Señal activa</span>
          {availableServers.length > 1 && (
            <span>📺 {availableServers.length} servidores disponibles</span>
          )}
          <span>⚡ Captura de pantalla en tiempo real</span>
        </div>
        <div className="disclaimer">
          <small>
            Esta transmisión es capturada desde la fuente original. 
            No retransmitimos contenido, solo mostramos la pantalla del canal oficial.
            {eventData && ` • ${eventData.sport} - ${eventData.name || eventData.teams?.join(' vs ')}`}
          </small>
        </div>
      </div>
    </div>
  );
};

export default ChannelPlayer;
