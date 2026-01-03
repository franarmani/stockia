import React from 'react';
import { motion } from 'framer-motion';

interface GradientCardProps {
  children: React.ReactNode;
  gradient?: 'blue' | 'purple' | 'pink' | 'green' | 'orange';
  className?: string;
  hover?: boolean;
}

const gradients = {
  blue: 'from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900',
  purple: 'from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900',
  pink: 'from-pink-50 to-pink-100 dark:from-pink-950 dark:to-pink-900',
  green: 'from-green-50 to-green-100 dark:from-green-950 dark:to-green-900',
  orange: 'from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900',
};

const borderGradients = {
  blue: 'from-blue-200 to-blue-300 dark:from-blue-700 dark:to-blue-600',
  purple: 'from-purple-200 to-purple-300 dark:from-purple-700 dark:to-purple-600',
  pink: 'from-pink-200 to-pink-300 dark:from-pink-700 dark:to-pink-600',
  green: 'from-green-200 to-green-300 dark:from-green-700 dark:to-green-600',
  orange: 'from-orange-200 to-orange-300 dark:from-orange-700 dark:to-orange-600',
};

export const GradientCard: React.FC<GradientCardProps> = ({
  children,
  gradient = 'blue',
  className = '',
  hover = true,
}) => (
  <motion.div
    whileHover={hover ? { y: -4, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' } : {}}
    className={`
      relative bg-gradient-to-br ${gradients[gradient]}
      rounded-xl p-6 border border-gradient bg-gradient-to-r ${borderGradients[gradient]}
      shadow-lg hover:shadow-2xl transition-shadow duration-300
      ${className}
    `}
  >
    {children}
  </motion.div>
);

// Card com efeito glassmorphism
export const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div
    className={`
      backdrop-blur-md bg-white/30 dark:bg-slate-900/30
      border border-white/40 dark:border-slate-700/40
      rounded-xl p-6
      shadow-xl
      ${className}
    `}
  >
    {children}
  </div>
);

// Card com borda animada
export const AnimatedBorderCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`relative rounded-xl overflow-hidden ${className}`}>
    <div
      className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-xl p-[2px] animate-pulse"
    />
    <div className="relative bg-white dark:bg-slate-900 rounded-xl p-6">
      {children}
    </div>
  </div>
);

// Card com sombra de profundidade
interface ElevatedCardProps {
  children: React.ReactNode;
  level?: 1 | 2 | 3 | 4;
  className?: string;
}

const shadowLevels = {
  1: 'shadow-md',
  2: 'shadow-lg',
  3: 'shadow-xl',
  4: 'shadow-2xl',
};

export const ElevatedCard: React.FC<ElevatedCardProps> = ({
  children,
  level = 2,
  className = '',
}) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className={`
      bg-white dark:bg-slate-900
      rounded-lg p-6
      border border-slate-200 dark:border-slate-700
      ${shadowLevels[level]}
      transition-all duration-300
      ${className}
    `}
  >
    {children}
  </motion.div>
);
