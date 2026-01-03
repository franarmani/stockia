// ========================================
// 🎨 UI/UX COMPONENTS - QUICK REFERENCE
// ========================================

// ✅ SKELETON LOADERS
export { 
  Skeleton, 
  SkeletonCard, 
  SkeletonTable, 
  SkeletonAvatar, 
  SkeletonHeader 
} from '@/components/ui/Skeleton';

// ✅ TOOLTIPS & INFO
export { 
  Tooltip, 
  InfoTooltip 
} from '@/components/ui/Tooltip';

// ✅ GRADIENT CARDS
export { 
  GradientCard, 
  GlassCard, 
  AnimatedBorderCard, 
  ElevatedCard 
} from '@/components/ui/GradientCards';

// ✅ LOADING STATES
export {
  LoadingSpinner,
  LoadingBar,
  LoadingDots,
  PulseElement,
  BounceElement,
  ShimmerEffect,
  FadeInScroll,
  SkeletonPulse,
} from '@/components/ui/LoadingStates';

// ✅ MOBILE COMPONENTS
export {
  ResponsiveContainer,
  MobileMenu,
  ResponsiveGrid,
  TouchButton,
  ResponsiveTable,
  Drawer,
} from '@/components/ui/MobileOptimized';

// ========================================
// 🎬 ANIMATION COMPONENTS
// ========================================

// ✅ PAGE TRANSITIONS
export {
  PageTransition,
  StaggerContainer,
  StaggerItem,
  ModalPageTransition,
  RouteTransition,
  SectionTransition,
  ElementTransition,
  ScrollReveal,
  Parallax,
  AnimatedText,
} from '@/components/animations/PageTransitions';

// ✅ ANIMATED COMPONENTS (ORIGINAL)
export {
  AnimatedStatCard,
  AnimatedCounter,
  AnimatedListItem,
  AnimatedButton,
  AnimatedModal,
} from '@/components/animations/AnimatedComponents';

// ========================================
// 📚 USAGE EXAMPLES
// ========================================

/*
// 1. SKELETON LOADER
import { SkeletonCard } from '@/components/ui';

if (loading) return <SkeletonCard count={3} />;

// 2. TOOLTIP
import { Tooltip, InfoTooltip } from '@/components/ui';

<Tooltip content="Help text" position="top">
  <button>Hover</button>
</Tooltip>

// 3. GRADIENT CARDS
import { GradientCard, GlassCard } from '@/components/ui';

<GradientCard gradient="blue">
  Content
</GradientCard>

// 4. LOADING STATES
import { LoadingSpinner, LoadingBar } from '@/components/ui';

<LoadingSpinner size="md" color="blue" />
<LoadingBar progress={75} />

// 5. MOBILE COMPONENTS
import { MobileMenu, TouchButton } from '@/components/ui';

<MobileMenu items={menuItems} />
<TouchButton variant="primary">Click</TouchButton>

// 6. PAGE TRANSITIONS
import { PageTransition, StaggerContainer } from '@/components/animations';

<PageTransition variant="slideUp">
  <StaggerContainer>
    {items.map(item => (...))}
  </StaggerContainer>
</PageTransition>

// 7. SCROLL REVEAL
import { ScrollReveal, Parallax } from '@/components/animations';

<ScrollReveal direction="up">
  Appears on scroll
</ScrollReveal>

<Parallax offset={50}>
  Parallax content
</Parallax>
*/
