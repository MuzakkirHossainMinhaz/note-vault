import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { notifyError } from '@/lib/api'

export function Login() {
  const { login, user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/notes" replace />

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim() || !password) return
    setSubmitting(true)
    try {
      await login({ email: email.trim(), password })
    } catch (error) {
      notifyError(error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader className="gap-2">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-primary">Welcome Back</p>
          <CardTitle className="text-2xl tracking-tight">Log In to NoteVault</CardTitle>
          <CardDescription>Sign in to continue to your notes and community.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Please Wait...' : 'Log In'}
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Need an account? <Link to="/register" className="underline">Register</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
