import React from 'react';
import { motion } from 'framer-motion';

// Page Transition Wrapper
interface PageTransitionProps {
  children: React.ReactNode;
  variant?: 'fade' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'zoom' | 'blur';
  duration?: number;
}

const variants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },
  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  slideLeft: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  slideRight: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  zoom: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  },
  blur: {
    initial: { opacity: 0, filter: 'blur(10px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, filter: 'blur(10px)' },
  },
};

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  variant = 'fade',
  duration = 0.3,
}) => (
  <motion.div
    initial={variants[variant].initial}
    animate={variants[variant].animate}
    exit={variants[variant].exit}
    transition={{ duration }}
  >
    {children}
  </motion.div>
);

// Stagger Container (para listas)
interface StaggerContainerProps {
  children: React.ReactNode;
  delay?: number;
  staggerChildren?: number;
}

export const StaggerContainer: React.FC<StaggerContainerProps> = ({
  children,
  delay = 0,
  staggerChildren = 0.1,
}) => (
  <motion.div
    initial="hidden"
    animate="show"
    variants={{
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren,
          delayChildren: delay,
        },
      },
    }}
  >
    {children}
  </motion.div>
);

// Stagger Item
interface StaggerItemProps {
  children: React.ReactNode;
}

export const StaggerItem: React.FC<StaggerItemProps> = ({ children }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 20 },
      show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    }}
  >
    {children}
  </motion.div>
);

// Modal Page Transition
interface ModalPageTransitionProps {
  isOpen: boolean;
  children: React.ReactNode;
  onClose?: () => void;
}

export const ModalPageTransition: React.FC<ModalPageTransitionProps> = ({
  isOpen,
  children,
  onClose,
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: isOpen ? 1 : 0 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    className={isOpen ? 'fixed inset-0 bg-black/50 z-40' : 'hidden'}
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: isOpen ? 1 : 0.95, opacity: isOpen ? 1 : 0 }}
      exit={{ scale: 0.95, opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 flex items-center justify-center pointer-events-none"
    >
      <div className="pointer-events-auto bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full mx-4">
        {children}
      </div>
    </motion.div>
  </motion.div>
);

// Route Transition (para Next.js)
interface RouteTransitionProps {
  children: React.ReactNode;
  direction?: 'forward' | 'backward';
}

export const RouteTransition: React.FC<RouteTransitionProps> = ({
  children,
  direction = 'forward',
}) => {
  const isForward = direction === 'forward';

  return (
    <motion.div
      initial={{
        opacity: 0,
        x: isForward ? 100 : -100,
      }}
      animate={{
        opacity: 1,
        x: 0,
      }}
      exit={{
        opacity: 0,
        x: isForward ? -100 : 100,
      }}
      transition={{
        duration: 0.3,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
};

// Section Transition (para scroll)
interface SectionTransitionProps {
  children: React.ReactNode;
  delay?: number;
}

export const SectionTransition: React.FC<SectionTransitionProps> = ({
  children,
  delay = 0,
}) => (
  <motion.section
    initial={{ opacity: 0, y: 50 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-100px' }}
    transition={{ duration: 0.5, delay }}
  >
    {children}
  </motion.section>
);

// Element Transition (genérico)
interface ElementTransitionProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
}

export const ElementTransition: React.FC<ElementTransitionProps> = ({
  children,
  delay = 0,
  duration = 0.4,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration }}
  >
    {children}
  </motion.div>
);

// Scroll-triggered Animation
interface ScrollRevealProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  distance?: number;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  direction = 'up',
  delay = 0,
  distance = 30,
}) => {
  const directions = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
        ...directions[direction],
      }}
      whileInView={{
        opacity: 1,
        x: 0,
        y: 0,
      }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5, delay }}
    >
      {children}
    </motion.div>
  );
};

// Parallax Scroll Effect
interface ParallaxProps {
  children: React.ReactNode;
  offset?: number;
}

export const Parallax: React.FC<ParallaxProps> = ({ children, offset = 50 }) => {
  const [scrollY, setScrollY] = React.useState(0);

  React.useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.div
      style={{
        y: scrollY * (offset / 100),
      }}
      transition={{ type: 'spring', stiffness: 100, damping: 30 }}
    >
      {children}
    </motion.div>
  );
};

// Text Animation (letra por letra)
interface AnimatedTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  className = '',
  delay = 0,
  duration = 0.05,
}) => {
  const letters = text.split('');

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: duration,
            delayChildren: delay,
          },
        },
      }}
      className={className}
    >
      {letters.map((letter, i) => (
        <motion.span
          key={i}
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0 },
          }}
        >
          {letter === ' ' ? '\u00A0' : letter}
        </motion.span>
      ))}
    </motion.div>
  );
};
