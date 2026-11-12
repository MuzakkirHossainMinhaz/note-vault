import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { notifyError, request } from '@/lib/api'
import { formatInterests, parseInterests } from '@/lib/utils'

export function Profile() {
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [interests, setInterests] = useState(formatInterests(user?.interests ?? []))
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setName(user?.name ?? '')
    setInterests(formatInterests(user?.interests ?? []))
  }, [user])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name.trim().length < 2 || (password.length > 0 && password.length < 8)) return
    setSubmitting(true)
    try {
      const body: { name: string; interests: string[]; password?: string } = {
        name: name.trim(),
        interests: parseInterests(interests),
      }
      if (password) body.password = password
      await request('/users/me', { method: 'PATCH', body })
      await refreshUser()
      setPassword('')
      toast.success('Profile updated.')
    } catch (error) {
      notifyError(error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="My Profile"
        description="Manage your account details, interests, and password."
      />
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Account Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input id="profile-name" minLength={2} maxLength={60} required value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={user?.email ?? ''} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-interests">Interests (Comma Separated)</Label>
              <Input id="profile-interests" value={interests} onChange={(event) => setInterests(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-password">New Password (Leave Blank to Keep Current)</Label>
              <Input id="profile-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Please Wait...' : 'Update Profile'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
