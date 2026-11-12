import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { user, loading } = useAuth()

  if (loading) return <p className="p-6 text-center text-muted-foreground">Loading...</p>
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/notes" replace />
  return <Outlet />
}
