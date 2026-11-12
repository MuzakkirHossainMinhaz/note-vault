import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { notifyError } from '@/lib/api'
import { parseInterests } from '@/lib/utils'

export function Register() {
  const { register, user, loading } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [interests, setInterests] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/notes" replace />

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name.trim().length < 2 || !email.trim() || password.length < 8) return
    setSubmitting(true)
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        interests: parseInterests(interests),
      })
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
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-primary">Get Started</p>
          <CardTitle className="text-2xl tracking-tight">Create Your Account</CardTitle>
          <CardDescription>Join the community and start organizing your notes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" autoComplete="name" minLength={2} maxLength={60} required value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (At Least 8 Characters)</Label>
              <Input id="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interests">Interests (Comma Separated)</Label>
              <Input id="interests" placeholder="reading, chess" value={interests} onChange={(event) => setInterests(event.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Please Wait...' : 'Register'}
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Already Registered? <Link to="/login" className="underline">Log In</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
