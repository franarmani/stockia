'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

const PUBLIC_ROUTES = ['/login', '/register', '/'];

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, token, loadFromStorage } = useAuthStore();

  useEffect(() => {
    // Cargar datos del localStorage al montar
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    // Si no está autenticado y no está en ruta pública, redirigir a login
    if (!isAuthenticated && !token && !PUBLIC_ROUTES.includes(pathname)) {
      router.push('/login');
    }
  }, [isAuthenticated, token, pathname, router]);

  if (!isAuthenticated && !token && !PUBLIC_ROUTES.includes(pathname)) {
    return null; // No renderizar nada mientras redirige
  }

  return <>{children}</>;
}
