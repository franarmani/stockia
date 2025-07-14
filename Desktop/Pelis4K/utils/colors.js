// Paleta de colores violeta para la aplicación
export const COLORS = {
  // Colores principales
  primary: '#9D50BB',           // violeta intenso
  black: '#4a0d63',             // casi negro con matiz púrpura
  black2: '#400f53',            // púrpura oscuro
  black3: '#1f032b',            // púrpura muy oscuro
  blackLighter: '#9D50BB',      // igual al primary
  blackLight: '#5b2670',        // púrpura medio
  pink: '#ed30ff',              // lila fuerte
  orange: '#050505',            // casi negro
  
  // Colores para componentes
  text: '#ffffff',              // texto principal
  textSecondary: '#9D50BB',     // texto secundario
  textMuted: '#5b2670',         // texto apagado
  
  // Colores para interfaz
  background: '#1f032b',        // fondo principal
  surface: '#4a0d63',           // superficies elevadas
  border: '#5b2670',            // bordes
  
  // Gradiente
  gradientStart: '#6A0DAD',     // inicio del gradiente
  gradientEnd: '#9D50BB',       // final del gradiente
  
  // Transparencias
  primaryTransparent: 'rgba(157, 80, 187, 0.2)',
  blackTransparent: 'rgba(74, 13, 99, 0.5)',
  overlayTransparent: 'rgba(31, 3, 43, 0.8)',
};

// Función para crear gradiente lineal (para uso con react-native-linear-gradient si se necesita)
export const createGradient = (colors = [COLORS.gradientStart, COLORS.gradientEnd]) => {
  return colors;
};

// Estilos comunes que se pueden reutilizar
export const COMMON_STYLES = {
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  
  cardStyle: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  
  buttonPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  
  buttonSecondary: {
    backgroundColor: COLORS.primaryTransparent,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
};
