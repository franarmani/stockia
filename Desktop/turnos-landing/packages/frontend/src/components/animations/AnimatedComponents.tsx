'use client';

import React from 'react';
import { motion } from 'framer-motion';

/**
 * Animated Stat Card con Framer Motion
 */
export function AnimatedStatCard({
  title,
  value,
  icon,
  color,
  delay = 0,
}: {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -5, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
      className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
        </div>
        <motion.div
          className="text-4xl"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {icon}
        </motion.div>
      </div>
    </motion.div>
  );
}

/**
 * Animated Counter (para números)
 */
export function AnimatedCounter({ value, duration = 2 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      setDisplayValue(Math.floor(value * progress));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

/**
 * Animated Page Transition
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated List Item
 */
export function AnimatedListItem({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ x: 5 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated Button
 */
export function AnimatedButton({
  children,
  onClick,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <motion.button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-all ${variants[variant]}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.button>
  );
}

/**
 * Animated Modal
 */
export function AnimatedModal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-lg max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
