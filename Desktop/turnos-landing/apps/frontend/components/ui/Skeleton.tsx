import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  count = 1,
}) => {
  const widthStyle = typeof width === 'number' ? `${width}px` : width;
  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  const baseClass = 'animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700';

  const variantClass = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  }[variant];

  const skeletons = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`${baseClass} ${variantClass} ${className}`}
      style={{
        width: widthStyle || '100%',
        height: heightStyle || variant === 'circular' ? widthStyle : '16px',
      }}
    />
  ));

  return count === 1 ? skeletons[0] : <div className="space-y-2">{skeletons}</div>;
};

// Skeleton para tarjetas
export const SkeletonCard: React.FC<{ count?: number }> = ({ count = 1 }) => {
  const cards = Array.from({ length: count }, (_, i) => (
    <div key={i} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
      <Skeleton height={20} width="80%" />
      <Skeleton height={16} width="100%" count={2} />
      <Skeleton height={32} width="40%" />
    </div>
  ));

  return count === 1 ? cards[0] : <div className="space-y-3">{cards}</div>;
};

// Skeleton para tabla
export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: columns }, (_, j) => (
            <Skeleton key={j} className="flex-1" height={40} />
          ))}
        </div>
      ))}
    </div>
  );
};

// Skeleton para avatar
export const SkeletonAvatar: React.FC = () => (
  <Skeleton variant="circular" width={40} height={40} />
);

// Skeleton para header
export const SkeletonHeader: React.FC = () => (
  <div className="space-y-4">
    <Skeleton height={32} width="60%" />
    <Skeleton height={16} width="100%" count={2} />
  </div>
);
