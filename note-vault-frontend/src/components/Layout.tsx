import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

function getNavLinkClassName({ isActive }: { isActive: boolean }) {
  return [
    'rounded-md px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive
      ? 'bg-primary/10 font-medium text-primary'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
  ].join(' ')
}

export function Layout() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  const signOut = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link to="/notes" className="text-lg font-semibold">
            NoteVault
          </Link>
          <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-1 text-sm">
            <NavLink to="/notes" end className={getNavLinkClassName}>Notes</NavLink>
            <NavLink to="/profile" end className={getNavLinkClassName}>Profile</NavLink>
            <NavLink to="/posts" end className={getNavLinkClassName}>Posts</NavLink>
            <NavLink to="/interests" end className={getNavLinkClassName}>Interests</NavLink>
            {isAdmin && (
              <>
                <NavLink to="/admin/users" end className={getNavLinkClassName}>Admin Users</NavLink>
                <NavLink to="/admin/notes" end className={getNavLinkClassName}>Admin Notes</NavLink>
              </>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user?.name} ({user?.role === 'admin' ? 'Admin' : 'User'})
            </span>
            <Button type="button" variant="outline" onClick={signOut}>
              Log Out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
