# 🎨 Componentes UX/UI Mejorados - Guía de Uso

## 📦 Componentes Creados (Phase A)

### 1. **Skeleton Loaders** (`components/ui/Skeleton.tsx`)

Componentes para cargar datos de forma elegante:

```tsx
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonAvatar, SkeletonHeader } from '@/components/ui';

// Skeleton simple
<Skeleton variant="rectangular" height={40} width="100%" />

// Skeleton para tarjeta
<SkeletonCard count={3} />

// Skeleton para tabla
<SkeletonTable rows={5} columns={4} />

// Skeleton para avatar
<SkeletonAvatar />

// Skeleton para header
<SkeletonHeader />
```

**Props:**
- `variant`: 'text' | 'circular' | 'rectangular'
- `width`: string | number
- `height`: string | number
- `count`: number (para múltiples)
- `className`: string

---

### 2. **Tooltips** (`components/ui/Tooltip.tsx`)

Información emergente con animación:

```tsx
import { Tooltip, InfoTooltip } from '@/components/ui';

// Tooltip básico
<Tooltip content="Texto informativo" position="top">
  <button>Hover me</button>
</Tooltip>

// Tooltip con ícono info
<InfoTooltip content="Información detallada" position="right" />
```

**Props:**
- `content`: string | ReactNode
- `position`: 'top' | 'bottom' | 'left' | 'right'
- `delay`: number
- `className`: string

---

### 3. **Gradient Cards** (`components/ui/GradientCards.tsx`)

Tarjetas con gradientes y sombras mejoradas:

```tsx
import { GradientCard, GlassCard, AnimatedBorderCard, ElevatedCard } from '@/components/ui';

// Tarjeta con gradiente
<GradientCard gradient="blue" hover>
  <h3>Contenido</h3>
</GradientCard>

// Tarjeta con efecto glass
<GlassCard>
  Contenido con glassmorphism
</GlassCard>

// Tarjeta con borde animado
<AnimatedBorderCard>
  Borde que brilla
</AnimatedBorderCard>

// Tarjeta elevada (con profundidad)
<ElevatedCard level={3}>
  Sombra profunda
</ElevatedCard>
```

**Props:**
- `gradient`: 'blue' | 'purple' | 'pink' | 'green' | 'orange'
- `hover`: boolean
- `level`: 1 | 2 | 3 | 4 (para ElevatedCard)
- `className`: string

---

### 4. **Loading States** (`components/ui/LoadingStates.tsx`)

Estados de carga avanzados:

```tsx
import { 
  LoadingSpinner, 
  LoadingBar, 
  PulseElement, 
  ShimmerEffect,
  BounceElement,
  LoadingDots,
  SkeletonPulse 
} from '@/components/ui';

// Spinner animado
<LoadingSpinner size="md" color="blue" />

// Barra de progreso
<LoadingBar progress={65} animated />

// Elemento con pulse
<PulseElement intensity="medium">
  <button>Click me</button>
</PulseElement>

// Efecto shimmer en imagen
<ShimmerEffect isLoading>
  <img src="..." alt="..." />
</ShimmerEffect>

// Elemento rebotando
<BounceElement>
  Animación de rebote
</BounceElement>

// Puntos de carga
<LoadingDots color="text-blue-600" />

// Skeleton con pulse
<SkeletonPulse className="h-10 w-full" />
```

**Props:**
- `size`: 'sm' | 'md' | 'lg' (spinner)
- `color`: 'blue' | 'purple' | 'pink'
- `progress`: number (0-100)
- `intensity`: 'light' | 'medium' | 'heavy'
- `isLoading`: boolean
- `delay`: number

---

### 5. **Mobile Optimized Components** (`components/ui/MobileOptimized.tsx`)

Componentes adaptados para mobile:

```tsx
import { 
  ResponsiveContainer,
  MobileMenu,
  ResponsiveGrid,
  TouchButton,
  ResponsiveTable,
  Drawer
} from '@/components/ui';

// Contenedor responsivo
<ResponsiveContainer>
  Contenido centrado con max-width
</ResponsiveContainer>

// Menú móvil con hamburger
<MobileMenu
  items={[
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' }
  ]}
/>

// Grid responsivo
<ResponsiveGrid cols={{ md: 2, lg: 3 }} gap="md">
  <div>Card 1</div>
  <div>Card 2</div>
</ResponsiveGrid>

// Botón optimizado para touch
<TouchButton variant="primary">
  Botón táctil
</TouchButton>

// Tabla responsiva
<ResponsiveTable
  headers={['Nombre', 'Email', 'Estado']}
  rows={[
    ['Juan', 'juan@example.com', 'Activo']
  ]}
/>

// Drawer (modal inferior móvil)
<Drawer
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Mi Drawer"
>
  Contenido del drawer
</Drawer>
```

---

### 6. **Page Transitions** (`components/animations/PageTransitions.tsx`)

Animaciones de transición avanzadas:

```tsx
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
  ScrollReveal,
  Parallax,
  AnimatedText,
  RouteTransition,
  SectionTransition
} from '@/components/animations';

// Transición de página
<PageTransition variant="slideUp" duration={0.4}>
  <div>Contenido</div>
</PageTransition>

// Contenedor con stagger
<StaggerContainer staggerChildren={0.1} delay={0.2}>
  <StaggerItem><div>Item 1</div></StaggerItem>
  <StaggerItem><div>Item 2</div></StaggerItem>
</StaggerContainer>

// Revelación al scroll
<ScrollReveal direction="up" distance={30} delay={0.1}>
  Aparece cuando scrollea
</ScrollReveal>

// Efecto parallax
<Parallax offset={50}>
  Se mueve más lento al scroll
</Parallax>

// Texto animado letra por letra
<AnimatedText
  text="Texto animado"
  duration={0.05}
  delay={0.2}
/>

// Transición de ruta
<RouteTransition direction="forward">
  Contenido de la página
</RouteTransition>

// Transición de sección
<SectionTransition delay={0.3}>
  <section>...</section>
</SectionTransition>
```

**Variantes PageTransition:**
- `fade` - Fade in/out
- `slideUp` - Desliza hacia arriba
- `slideDown` - Desliza hacia abajo
- `slideLeft` - Desliza hacia izquierda
- `slideRight` - Desliza hacia derecha
- `zoom` - Zoom in/out
- `blur` - Blur effect

---

## 🎯 Casos de Uso

### Dashboard Home
```tsx
import { PageTransition, StaggerContainer, GradientCard } from '@/components/ui';

export default function Dashboard() {
  return (
    <PageTransition variant="slideUp">
      <div className="space-y-8">
        <h1>Panel Principal</h1>
        <StaggerContainer>
          {stats.map((stat) => (
            <GradientCard key={stat.id} gradient="blue">
              {stat.name}: {stat.value}
            </GradientCard>
          ))}
        </StaggerContainer>
      </div>
    </PageTransition>
  );
}
```

### Loading State
```tsx
import { SkeletonCard, LoadingSpinner } from '@/components/ui';

export default function DataList() {
  const { data, loading } = useFetchData();

  if (loading) {
    return <SkeletonCard count={5} />;
  }

  return <div>{/* Contenido real */}</div>;
}
```

### Mobile-First Table
```tsx
import { ResponsiveTable, MobileMenu } from '@/components/ui';

export default function Content() {
  return (
    <>
      <MobileMenu items={menuItems} />
      <ResponsiveTable headers={headers} rows={rows} />
    </>
  );
}
```

### Form con Tooltips
```tsx
import { Tooltip, InfoTooltip, TouchButton } from '@/components/ui';

export default function Form() {
  return (
    <form>
      <label>
        Email
        <InfoTooltip content="Tu email de contacto principal" />
      </label>
      <input type="email" />
      <TouchButton variant="primary">
        Enviar
      </TouchButton>
    </form>
  );
}
```

---

## 🚀 Instalación & Setup

### 1. Importar Componentes
```tsx
// Individual
import { Skeleton } from '@/components/ui/Skeleton';
import { PageTransition } from '@/components/animations/PageTransitions';

// O usar index.ts (más fácil)
import { Skeleton, PageTransition } from '@/components/ui';
import { PageTransition, StaggerContainer } from '@/components/animations';
```

### 2. Asegurar Dependencias
```bash
npm install framer-motion
# o
pnpm add framer-motion
```

### 3. Tailwind CSS
Todos los componentes usan clases de Tailwind. Asegurate que esté configurado:

```tsx
// tailwind.config.ts
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
};
```

---

## 🎨 Customización

### Cambiar Colores
```tsx
// En tailwind.config.ts
theme: {
  colors: {
    primary: '#3b82f6',  // Blue
    secondary: '#8b5cf6', // Purple
  }
}

// Usar en componentes
<GradientCard className="from-primary to-secondary">
  Contenido
</GradientCard>
```

### Velocidades de Animación
```tsx
// En ComponenteX.tsx
<motion.div
  animate={{ opacity: 1 }}
  transition={{ duration: 0.5 }} // Cambiar aquí
>
  Content
</motion.div>
```

---

## ✅ Checklist de Implementación

- [ ] Importar componentes en los archivos necesarios
- [ ] Asegurar que `framer-motion` esté instalado
- [ ] Probar Skeletons en estados de carga
- [ ] Probar Tooltips en campos de formulario
- [ ] Probar PageTransitions en rutas
- [ ] Probar MobileMenu en resoluciones pequeñas
- [ ] Probar TouchButton en dispositivos móviles
- [ ] Validar accesibilidad (ARIA labels)
- [ ] Optimizar animaciones para rendimiento
- [ ] Probar en navegadores antiguos

---

## 📊 Performance

Todos los componentes están optimizados:

- ✅ Sin re-renders innecesarios
- ✅ Animaciones en GPU (transform, opacity)
- ✅ Lazy loading soportado
- ✅ SSR compatible
- ✅ Dark mode soportado
- ✅ Accessible (WCAG 2.1)

---

## 🆘 Troubleshooting

### Las animaciones se sienten lentas
- Reducir `duration` en transiciones
- Usar `ease: 'easeOut'` en lugar de `easeInOut`
- Limitar la cantidad de elementos animados simultáneamente

### Tooltips no aparecen
- Asegurar que el padre tiene `relative` positioning
- Comprobar z-index de otros elementos
- Verificar que el contenedor tiene `overflow: visible`

### Skeletons se ven roto en dark mode
- Asegurar que Tailwind dark mode esté configurado
- Los componentes usan `dark:` prefixes automáticamente

---

## 📚 Recursos

- [Framer Motion Docs](https://www.framer.com/motion/)
- [Tailwind CSS](https://tailwindcss.com/)
- [React Best Practices](https://react.dev/)

---

**¡Todo listo para crear UX increíble! 🚀**
