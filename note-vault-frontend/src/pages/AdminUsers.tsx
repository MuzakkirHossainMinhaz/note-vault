import { useCallback, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { PaginationControls } from '@/components/PaginationControls'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePaginated } from '@/hooks/usePaginated'
import { notifyError, request } from '@/lib/api'
import { formatInterests, parseInterests } from '@/lib/utils'
import type { PaginatedResponse, Role, User } from '@/types'

export function AdminUsers() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [interests, setInterests] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadPage = useCallback((page: number) => {
    const params = new URLSearchParams({ page: String(page), limit: '10' })
    return request<PaginatedResponse<User>>(`/users?${params}`)
  }, [])

  const { page, data, pagination, loading, error, setPage, reload } = usePaginated(loadPage)

  const openNewUser = () => {
    setEditingUser(null)
    setName('')
    setEmail('')
    setPassword('')
    setRole('user')
    setInterests('')
    setDialogOpen(true)
  }

  const openEditUser = (user: User) => {
    setEditingUser(user)
    setName(user.name)
    setEmail(user.email)
    setPassword('')
    setRole(user.role)
    setInterests(formatInterests(user.interests))
    setDialogOpen(true)
  }

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name.trim().length < 2 || !email.trim() || (!editingUser && password.length < 8) || (password && password.length < 8)) return
    setSubmitting(true)
    try {
      const body: {
        name: string
        email: string
        role: Role
        interests: string[]
        password?: string
      } = {
        name: name.trim(),
        email: email.trim(),
        role,
        interests: parseInterests(interests),
      }
      if (password) body.password = password
      if (editingUser) {
        await request(`/users/${encodeURIComponent(editingUser._id)}`, { method: 'PATCH', body })
        toast.success('User updated.')
      } else {
        await request('/users', { method: 'POST', body })
        toast.success('User created.')
        setPage(1)
      }
      setDialogOpen(false)
      reload()
    } catch (cause) {
      notifyError(cause)
    } finally {
      setSubmitting(false)
    }
  }

  const deleteUser = async (user: User) => {
    try {
      await request<void>(`/users/${encodeURIComponent(user._id)}`, { method: 'DELETE' })
      toast.success('User deleted.')
      reload()
    } catch (cause) {
      notifyError(cause)
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Admin Users"
        description="Manage NoteVault accounts, roles, and interests."
        action={<Button type="button" onClick={openNewUser}>Add User</Button>}
      />

      {loading && <p className="text-muted-foreground">Loading users...</p>}
      {!loading && error && <p role="status">{error}</p>}
      {!loading && !error && data.length === 0 && (
        <p className="text-muted-foreground">No users found.</p>
      )}
      {data.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Interests</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell><Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge></TableCell>
                    <TableCell>{formatInterests(user.interests)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openEditUser(user)}>Edit</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive" size="sm">Delete</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User {user.email}?</AlertDialogTitle>
                              <AlertDialogDescription>This also deletes their notes and posts.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" onClick={() => void deleteUser(user)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <PaginationControls pagination={pagination} page={page} loading={loading} onPageChange={setPage} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle></DialogHeader>
          <form onSubmit={saveUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Name</Label>
              <Input id="user-name" minLength={2} maxLength={60} required value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">{editingUser ? 'New Password (Optional)' : 'Password'}</Label>
              <Input id="user-password" type="password" autoComplete="new-password" minLength={password ? 8 : undefined} required={!editingUser} value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value === 'admin' ? 'admin' : 'user')}>
                <SelectTrigger id="user-role" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-interests">Interests (Comma Separated)</Label>
              <Input id="user-interests" value={interests} onChange={(event) => setInterests(event.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>{submitting ? 'Please Wait...' : 'Save User'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
