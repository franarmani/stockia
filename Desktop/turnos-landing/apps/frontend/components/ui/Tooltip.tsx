import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 0.2,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionVariants = {
    top: { y: -10, x: '-50%', left: '50%', top: 'auto', bottom: '100%', marginBottom: '8px' },
    bottom: { y: 10, x: '-50%', left: '50%', top: '100%', marginTop: '8px' },
    left: { x: -10, y: '-50%', left: 'auto', right: '100%', top: '50%', marginRight: '8px' },
    right: { x: 10, y: '-50%', left: '100%', top: '50%', marginLeft: '8px' },
  };

  const arrowVariants = {
    top: 'border-t-gray-900 dark:border-t-gray-100 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'border-b-gray-900 dark:border-b-gray-100 border-l-transparent border-r-transparent border-t-transparent',
    left: 'border-l-gray-900 dark:border-l-gray-100 border-t-transparent border-b-transparent border-r-transparent',
    right: 'border-r-gray-900 dark:border-r-gray-100 border-t-transparent border-b-transparent border-l-transparent',
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, delay }}
            className="absolute z-50 px-3 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg whitespace-nowrap shadow-lg"
            style={positionVariants[position] as React.CSSProperties}
          >
            {content}
            <div
              className={`absolute w-0 h-0 border-4 ${arrowVariants[position]}`}
              style={{
                ...(position === 'top' && { left: '50%', transform: 'translateX(-50%)' }),
                ...(position === 'bottom' && { left: '50%', transform: 'translateX(-50%)' }),
                ...(position === 'left' && { top: '50%', transform: 'translateY(-50%)' }),
                ...(position === 'right' && { top: '50%', transform: 'translateY(-50%)' }),
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Tooltip con ícono info
export const InfoTooltip: React.FC<{
  content: string | React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}> = ({ content, position = 'top', className = '' }) => (
  <Tooltip content={content} position={position} className={className}>
    <button className="inline-flex items-center justify-center w-5 h-5 text-gray-400 rounded-full hover:text-gray-600 dark:hover:text-gray-300">
      <svg
        className="w-4 h-4"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  </Tooltip>
);
