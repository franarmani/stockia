import React, { useEffect, useState } from "react";
import "./style.scss";

const CustomCursor = () => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isMobile, setIsMobile] = useState(false);

  console.log('🚀 CustomCursor component renderizado');

  // Detectar móvil simple
  useEffect(() => {
    const checkMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
    setIsMobile(checkMobile);
    console.log('🔍 Dispositivo detectado:', checkMobile ? 'MÓVIL' : 'PC');
  }, []);

  // Eventos del mouse
  useEffect(() => {
    if (isMobile) {
      console.log('📱 Móvil - no agregando eventos');
      return;
    }

    console.log('💻 PC - agregando eventos del mouse');

    const handleMouseMove = (e) => {
      console.log('🖱️ Mouse movido a:', e.clientX, e.clientY);
      setPosition({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener("mousemove", handleMouseMove);
    
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isMobile]);

  if (isMobile) {
    console.log('📱 Retornando null - móvil detectado');
    return null;
  }

  console.log('🎯 Renderizando cursor visible en:', position);

  return (
    <div
      className="cursor-debug-simple"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '40px',
        height: '40px',
        background: 'red',
        border: '4px solid yellow',
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: '999999',
        transform: 'translate(-50%, -50%)'
      }}
    />
  );
};

export default CustomCursor;
