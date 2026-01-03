import React from 'react';
import { motion } from 'framer-motion';

// Loading Spinner
export const LoadingSpinner: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'purple' | 'pink';
}> = ({ size = 'md', color = 'blue' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const colors = {
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    pink: 'text-pink-600',
  };

  return (
    <motion.div
      className={`${sizes[size]} ${colors[color]}`}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    >
      <svg
        className="w-full h-full"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </motion.div>
  );
};

// Loading Bar (Progress)
export const LoadingBar: React.FC<{
  progress?: number;
  animated?: boolean;
}> = ({ progress = 65, animated = true }) => (
  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
    <motion.div
      className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full"
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      transition={{ duration: 0.5 }}
      style={{
        backgroundImage: animated
          ? 'linear-gradient(90deg, #3b82f6, #a855f7, #3b82f6)'
          : undefined,
        backgroundSize: animated ? '200% 100%' : undefined,
      }}
    />
  </div>
);

// Pulse Animation
export const PulseElement: React.FC<{
  children: React.ReactNode;
  intensity?: 'light' | 'medium' | 'heavy';
}> = ({ children, intensity = 'medium' }) => {
  const scales = {
    light: { scale: [1, 1.02, 1] },
    medium: { scale: [1, 1.05, 1] },
    heavy: { scale: [1, 1.1, 1] },
  };

  return (
    <motion.div
      animate={scales[intensity]}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
};

// Shimmer Effect (para imagens)
export const ShimmerEffect: React.FC<{
  children: React.ReactNode;
  isLoading?: boolean;
}> = ({ children, isLoading = true }) => {
  if (!isLoading) return children;

  return (
    <div className="relative overflow-hidden rounded-lg">
      {children}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
        animate={{ x: ['100%', '-100%'] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
};

// Bounce Animation
export const BounceElement: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <motion.div
    animate={{ y: [0, -10, 0] }}
    transition={{
      duration: 1,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  >
    {children}
  </motion.div>
);

// Fade In Scroll Animation
export const FadeInScroll: React.FC<{
  children: React.ReactNode;
  delay?: number;
}> = ({ children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-100px' }}
    transition={{ duration: 0.5, delay }}
  >
    {children}
  </motion.div>
);

// Loading Dots
export const LoadingDots: React.FC<{
  color?: string;
}> = ({ color = 'text-blue-600' }) => (
  <div className="flex gap-1">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className={`w-2 h-2 rounded-full ${color}`}
        animate={{ y: [0, -8, 0] }}
        transition={{
          duration: 0.6,
          repeat: Infinity,
          delay: i * 0.2,
        }}
      />
    ))}
  </div>
);

// Skeleton Pulse (alternativa ao Skeleton simples)
export const SkeletonPulse: React.FC<{
  className?: string;
}> = ({ className = '' }) => (
  <motion.div
    className={`bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded-lg ${className}`}
    animate={{
      backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
    style={{
      backgroundSize: '200% 200%',
    }}
  />
);
