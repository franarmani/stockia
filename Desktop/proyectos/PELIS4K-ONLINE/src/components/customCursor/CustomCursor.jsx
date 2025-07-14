import React, { useEffect, useState, useRef } from "react";
import "./style.scss";

const CustomCursor = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isOverIframe, setIsOverIframe] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const hideTimeoutRef = useRef(null);

  // Detectar móvil - solo pantallas muy pequeñas con touch
  useEffect(() => {
    const isRealMobile = window.innerWidth <= 480 && 'ontouchstart' in window;
    setIsMobile(isRealMobile);
  }, []);

  // Eventos del mouse y auto-hide
  useEffect(() => {
    if (isMobile) {
      return;
    }

    // Función para resetear el timer de auto-hide
    const resetHideTimer = () => {
      setIsActive(true);
      setIsVisible(true);
      
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      
      // Ocultar después de 3 segundos de inactividad
      hideTimeoutRef.current = setTimeout(() => {
        setIsActive(false);
        setIsVisible(false);
      }, 3000);
    };    const handleMouseMove = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
      resetHideTimer();
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
      setIsActive(true);
      resetHideTimer();
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
      setIsActive(false);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };

    const handleMouseOver = (e) => {
      if (!e || !e.target) return;
      
      const target = e.target;
      resetHideTimer();
      
      // Detectar si estamos sobre un iframe
      if (target.tagName === 'IFRAME' || target.closest('iframe')) {
        setIsOverIframe(true);
        setIsHovering(false);
      } else {
        setIsOverIframe(false);
        // Detectar elementos interactivos
        const isInteractive = target.closest('a, button, input, textarea, select, .movieCard, .poster, [onclick]') || 
                             target.style.cursor === 'pointer' ||
                             (window.getComputedStyle && window.getComputedStyle(target).cursor === 'pointer');
        
        setIsHovering(!!isInteractive);
      }
    };

    // Agregar eventos
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseover", handleMouseOver);

    // Activar inicialmente
    resetHideTimer();

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseenter", handleMouseEnter);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseover", handleMouseOver);
    };
  }, [isMobile]);  // No mostrar en móviles o sobre iframes
  if (isMobile || isOverIframe) {
    return null;
  }

  return (
    <>
      <div
        className={`custom-cursor ${(isVisible || isActive) ? 'visible' : ''} ${isHovering ? 'hovering' : ''}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      />
    </>
  );
};

export default CustomCursor;
