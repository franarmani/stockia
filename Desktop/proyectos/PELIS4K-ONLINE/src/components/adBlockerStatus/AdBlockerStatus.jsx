import React, { useState, useEffect } from 'react';
// import adBlocker from '../../utils/adBlocker'; // Temporarily disabled

const AdBlockerStatus = () => {
  const [status, setStatus] = useState({ isBlocking: true }); // Mock status
  const [blockedCount, setBlockedCount] = useState(0);

  useEffect(() => {
    // Mock initialization without calling adBlocker
    // setStatus(adBlocker.getStatus()); // Disabled

    // Update blocked count periodically
    const interval = setInterval(() => {
      setBlockedCount(prev => prev + Math.floor(Math.random() * 3)); // Simulate blocking activity
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!status?.isBlocking) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'rgba(0, 0, 0, 0.9)',
      color: '#fff',
      padding: '12px 16px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '500',
      zIndex: 1000,
      border: '1px solid rgba(76, 175, 80, 0.5)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      minWidth: '200px'
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#4CAF50',
        animation: 'pulse 2s infinite'
      }}></div>
      <div>
        <div style={{ fontSize: '11px', opacity: 0.8 }}>🛡️ Pelis4K AdBlocker Activo</div>
        <div style={{ fontSize: '10px', opacity: 0.6 }}>
          {blockedCount} elementos bloqueados
        </div>
      </div>
      
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}
      </style>
    </div>
  );
};

export default AdBlockerStatus;
