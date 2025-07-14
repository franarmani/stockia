import React from "react";
import ContentWrapper from "../contentWrapper/ContentWrapper";
import "./style.scss";

const Footer = () => {
  return (
    <footer className="footer">
      <ContentWrapper>
        
        <div className="infoText">
          Este sitio web es solo con fines educativos y de demostración. No almacenamos archivos en nuestros servidores.
          Todo el contenido es proporcionado por terceros no afiliados.
        </div>
        <div className="copyText">
          © 2025 Pelis4K. Todos los derechos reservados.
        </div>
       
      </ContentWrapper>
    </footer>
  );
};

export default Footer;