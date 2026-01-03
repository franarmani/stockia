'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AnimatedStatCard, AnimatedButton, PageTransition } from '@/components/animations/AnimatedComponents';
import { PageTransition as PageTransitionAnimated, StaggerContainer, StaggerItem, ScrollReveal } from '@/components/animations/PageTransitions';
import { GradientCard, ElevatedCard, GlassCard } from '@/components/ui/GradientCards';
import { LoadingSpinner, LoadingDots, FadeInScroll } from '@/components/ui/LoadingStates';
import { Tooltip, InfoTooltip } from '@/components/ui/Tooltip';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { motion } from 'framer-motion';

interface DashboardStats {
  appointments: {
    total: number;
    confirmed: number;
    completed: number;
    revenue: number;
  };
  services: {
    total: number;
    active: number;
    avgPrice: number;
  };
  employees: {
    total: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [appointmentsRes, servicesRes, employeesRes] = await Promise.all([
          api.get('/api/appointments/stats'),
          api.get('/api/services/stats'),
          api.get('/api/employees/stats'),
        ]);

        setStats({
          appointments: appointmentsRes.data,
          services: servicesRes.data,
          employees: employeesRes.data,
        });
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError('Error cargando datos del dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header Skeleton */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-8 text-white">
          <Skeleton height={40} width="40%" className="mb-2" />
          <Skeleton height={20} width="60%" />
        </div>

        {/* Stats Skeleton Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <ElevatedCard key={i} level={2}>
              <Skeleton height={80} />
            </ElevatedCard>
          ))}
        </div>

        {/* Quick Actions Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} height={150} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700"
      >
        {error}
      </motion.div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  };

  return (
    <PageTransitionAnimated variant="slideUp">
      <div className="space-y-8">
        {/* Welcome Section with Glass Effect */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-xl p-8 text-white shadow-2xl overflow-hidden relative"
        >
          {/* Animated Background */}
          <motion.div
            className="absolute inset-0 opacity-20"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.2) 0%, transparent 70%)',
            }}
          />
          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-2">¡Bienvenido al Panel!</h1>
            <p className="text-indigo-100 text-lg">
              Gestiona tu negocio de forma integral y eficiente
            </p>
          </div>
        </motion.div>

        {/* Stats Grid with Stagger Animation */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Estadísticas</h2>
            <Tooltip content="Datos del mes actual" position="left">
              <InfoTooltip content="Tus métricas principales actualizadas en tiempo real" />
            </Tooltip>
          </div>
          
          <StaggerContainer staggerChildren={0.08}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Appointments */}
              <StaggerItem>
                <GradientCard gradient="blue" hover>
                  <AnimatedStatCard
                    title="Turnos Totales"
                    value={stats?.appointments.total || 0}
                    icon="📅"
                    color="text-blue-600"
                    delay={0}
                  />
                </GradientCard>
              </StaggerItem>

              <StaggerItem>
                <GradientCard gradient="green" hover>
                  <AnimatedStatCard
                    title="Confirmados"
                    value={stats?.appointments.confirmed || 0}
                    icon="✅"
                    color="text-green-600"
                    delay={0}
                  />
                </GradientCard>
              </StaggerItem>

              <StaggerItem>
                <GradientCard gradient="purple" hover>
                  <AnimatedStatCard
                    title="Completados"
                    value={stats?.appointments.completed || 0}
                    icon="🎉"
                    color="text-purple-600"
                    delay={0}
                  />
                </GradientCard>
              </StaggerItem>

              <StaggerItem>
                <GradientCard gradient="orange" hover>
                  <AnimatedStatCard
                    title="Ingresos"
                    value={`$${(stats?.appointments.revenue || 0).toFixed(2)}`}
                    icon="💰"
                    color="text-orange-600"
                    delay={0}
                  />
                </GradientCard>
              </StaggerItem>

              {/* Services */}
              <StaggerItem>
                <ElevatedCard level={2}>
                  <AnimatedStatCard
                    title="Servicios"
                    value={stats?.services.total || 0}
                    icon="✨"
                    color="text-purple-600"
                    delay={0}
                  />
                </ElevatedCard>
              </StaggerItem>

              <StaggerItem>
                <ElevatedCard level={2}>
                  <AnimatedStatCard
                    title="Activos"
                    value={stats?.services.active || 0}
                    icon="⚡"
                    color="text-yellow-600"
                    delay={0}
                  />
                </ElevatedCard>
              </StaggerItem>

              <StaggerItem>
                <ElevatedCard level={2}>
                  <AnimatedStatCard
                    title="Precio Promedio"
                    value={`$${(stats?.services.avgPrice || 0).toFixed(2)}`}
                    icon="💵"
                    color="text-indigo-600"
                    delay={0}
                  />
                </ElevatedCard>
              </StaggerItem>

              {/* Employees */}
              <StaggerItem>
                <ElevatedCard level={2}>
                  <AnimatedStatCard
                    title="Profesionales"
                    value={stats?.employees.total || 0}
                    icon="👥"
                    color="text-pink-600"
                    delay={0}
                  />
                </ElevatedCard>
              </StaggerItem>
            </div>
          </StaggerContainer>
        </div>

        {/* Quick Actions Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Acciones Rápidas</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                href: '/dashboard/appointments',
                icon: '📅',
                title: 'Ver Turnos',
                desc: 'Gestiona tus turnos agendados',
                color: 'from-blue-500 to-blue-600',
                badge: 'Popular',
              },
              {
                href: '/dashboard/services',
                icon: '✨',
                title: 'Servicios',
                desc: 'Crea y edita servicios',
                color: 'from-purple-500 to-purple-600',
              },
              {
                href: '/dashboard/employees',
                icon: '👥',
                title: 'Empleados',
                desc: 'Administra tu equipo',
                color: 'from-pink-500 to-pink-600',
              },
              {
                href: '/dashboard/clients',
                icon: '👤',
                title: 'Clientes',
                desc: 'Lista de tus clientes',
                color: 'from-green-500 to-green-600',
              },
              {
                href: '/dashboard/settings',
                icon: '⚙️',
                title: 'Configuración',
                desc: 'Personaliza tu negocio',
                color: 'from-gray-500 to-gray-600',
              },
              {
                href: '/book/your-subdomain',
                icon: '🔗',
                title: 'Link Público',
                desc: 'Comparte tu página',
                color: 'from-indigo-500 to-indigo-600',
                badge: 'Nuevo',
              },
            ].map((action, idx) => (
              <ScrollReveal key={idx} delay={idx * 0.1} direction="up">
                <motion.a
                  href={action.href}
                  whileHover={{ y: -8 }}
                  whileTap={{ scale: 0.98 }}
                  className={`group relative block bg-gradient-to-br ${action.color} text-white rounded-lg p-6 cursor-pointer overflow-hidden transition-all hover:shadow-2xl`}
                >
                  {/* Animated Background */}
                  <motion.div
                    className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-white"
                    transition={{ duration: 0.3 }}
                  />

                  {/* Badge */}
                  {action.badge && (
                    <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold">
                      {action.badge}
                    </div>
                  )}

                  {/* Content */}
                  <div className="relative z-10">
                    <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">
                      {action.icon}
                    </div>
                    <h3 className="font-bold text-lg mb-1">{action.title}</h3>
                    <p className="text-sm opacity-90 group-hover:opacity-100 transition-opacity">
                      {action.desc}
                    </p>
                  </div>

                  {/* Arrow Icon */}
                  <motion.div
                    className="absolute bottom-4 right-4 text-white/50 group-hover:text-white transition-colors"
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </motion.div>
                </motion.a>
              </ScrollReveal>
            ))}
          </div>
        </div>

        {/* Footer Stats */}
        <FadeInScroll delay={0.5}>
          <GlassCard className="border-l-4 border-indigo-500">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  💡 Consejo del día
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Completa tu perfil y agrega una foto para que tus clientes te conozcan mejor.
                </p>
              </div>
              <button className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium whitespace-nowrap ml-4">
                Ir →
              </button>
            </div>
          </GlassCard>
        </FadeInScroll>
      </div>
    </PageTransitionAnimated>
  );
}
