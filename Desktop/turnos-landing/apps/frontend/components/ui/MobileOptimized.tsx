import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Responsive Container
export const ResponsiveContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
    {children}
  </div>
);

// Mobile Menu (Hamburger)
interface MobileMenuProps {
  items: Array<{
    label: string;
    href: string;
    icon?: React.ReactNode;
  }>;
  onClose?: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ items, onClose }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);
  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  return (
    <div className="md:hidden">
      {/* Hamburger Button */}
      <button
        onClick={toggleMenu}
        className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={isOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
          />
        </svg>
      </button>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 bg-black/50 z-40"
            />

            {/* Menu */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 z-50 overflow-y-auto"
            >
              <div className="p-6 space-y-4">
                <button
                  onClick={handleClose}
                  className="ml-auto block text-gray-500 dark:text-gray-400"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {items.map((item, i) => (
                  <motion.a
                    key={item.href}
                    href={item.href}
                    onClick={handleClose}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {item.icon && <span>{item.icon}</span>}
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {item.label}
                    </span>
                  </motion.a>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// Responsive Grid
interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'sm' | 'md' | 'lg';
}

const gapClasses = {
  sm: 'gap-2 sm:gap-3',
  md: 'gap-4 sm:gap-6',
  lg: 'gap-6 sm:gap-8',
};

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  cols = { default: 1, sm: 1, md: 2, lg: 3, xl: 4 },
  gap = 'md',
}) => {
  const colsClass = `
    grid 
    grid-cols-${cols.default || 1}
    sm:grid-cols-${cols.sm || 1}
    md:grid-cols-${cols.md || 2}
    lg:grid-cols-${cols.lg || 3}
    xl:grid-cols-${cols.xl || 4}
    ${gapClasses[gap]}
  `;

  return <div className={colsClass}>{children}</div>;
};

// Touch-Friendly Button
export const TouchButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  className?: string;
}> = ({ children, onClick, variant = 'primary', className = '' }) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95',
    secondary: 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white hover:bg-gray-300',
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`
        min-h-[44px] min-w-[44px] px-4 py-3 rounded-lg font-medium
        transition-all duration-200
        ${variants[variant]}
        ${className}
      `}
    >
      {children}
    </motion.button>
  );
};

// Responsive Table
interface ResponsiveTableProps {
  headers: string[];
  rows: Array<Array<string | React.ReactNode>>;
  className?: string;
}

export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  headers,
  rows,
  className = '',
}) => {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {headers.map((header, i) => (
              <th
                key={i}
                className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-3 sm:px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Drawer (Mobile-first Bottom Sheet)
interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 z-40"
        />

        {/* Drawer */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-2xl max-h-[90vh] overflow-y-auto"
        >
          <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900">
            {title && <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>}
            <button
              onClick={onClose}
              className="ml-auto text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          <div className="p-6">
            {children}
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);
