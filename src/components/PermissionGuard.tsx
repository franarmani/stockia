import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAuthStore } from '@/stores/authStore'

export default function PermissionGuard({ permission, children }: { permission: string; children: ReactNode }) {
  const { profile } = useAuthStore()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    if (!profile) return
    if (profile.role === 'admin' || profile.is_superadmin) { setAllowed(true); return }
    ;(supabase as any).from('user_permissions').select('allowed').eq('user_id', profile.id).eq('permission', permission).maybeSingle()
      .then(({ data }: any) => setAllowed(data?.allowed === true))
      .catch(() => setAllowed(false))
  }, [profile, permission])

  if (allowed === null) return <LoadingSpinner />
  if (!allowed) return <Navigate to="/menu" replace />
  return <>{children}</>
}
