import { useCallback, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { PaginationControls } from '@/components/PaginationControls'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/context/AuthContext'
import { notifyError, request } from '@/lib/api'
import { usePaginated } from '@/hooks/usePaginated'
import type { Note, PaginatedResponse } from '@/types'

interface NoteForm {
  title: string
  content: string
}

export function Notes() {
  const { user, isAdmin } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [viewingNote, setViewingNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadPage = useCallback(async (page: number): Promise<PaginatedResponse<Note>> => {
    const params = new URLSearchParams({ page: String(page), limit: '10' })
    if (isAdmin && user) params.set('owner', user._id)
    return request<PaginatedResponse<Note>>(`/notes?${params}`)
  }, [isAdmin, user])

  const { page, data, pagination, loading, error, setPage, reload } = usePaginated(loadPage)

  const openNewNote = () => {
    setEditingNote(null)
    setTitle('')
    setContent('')
    setDialogOpen(true)
  }

  const openEditNote = (note: Note) => {
    setEditingNote(note)
    setTitle(note.title)
    setContent(note.content)
    setDialogOpen(true)
  }

  const saveNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !content.trim()) return
    setSubmitting(true)
    try {
      const body: NoteForm = { title, content }
      if (editingNote) {
        await request(`/notes/${encodeURIComponent(editingNote._id)}`, { method: 'PATCH', body })
        toast.success('Note updated.')
      } else {
        await request('/notes', { method: 'POST', body })
        toast.success('Note created.')
      }
      setDialogOpen(false)
      if (!editingNote) setPage(1)
      reload()
    } catch (cause) {
      notifyError(cause)
    } finally {
      setSubmitting(false)
    }
  }

  const deleteNote = async (note: Note) => {
    try {
      await request<void>(`/notes/${encodeURIComponent(note._id)}`, { method: 'DELETE' })
      toast.success('Note deleted.')
      reload()
    } catch (cause) {
      notifyError(cause)
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Personal Workspace"
        title="My Notes"
        description="Create, update, and keep your personal notes organized."
        action={<Button type="button" onClick={openNewNote}>Create a Note</Button>}
      />

      {loading && <p className="text-muted-foreground">Loading notes...</p>}
      {!loading && error && <p role="status">{error}</p>}
      {!loading && !error && data.length === 0 && <p className="text-muted-foreground">No notes yet.</p>}
      {data.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableCaption className="sr-only">Your Saved Notes</TableCaption>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Title</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead className="hidden whitespace-nowrap md:table-cell">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((note) => (
                  <TableRow key={note._id}>
                    <TableCell className="max-w-48">
                      <p className="max-w-48 truncate font-medium">{note.title}</p>
                    </TableCell>
                    <TableCell className="max-w-64">
                      <p className="max-w-64 truncate text-muted-foreground">{note.content}</p>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground md:table-cell">
                      {new Date(note.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`View note: ${note.title}`}
                          onClick={() => setViewingNote(note)}
                        >
                          View
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => openEditNote(note)}>Edit</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive" size="sm">Delete</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete This Note?</AlertDialogTitle>
                              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" onClick={() => void deleteNote(note)}>Delete</AlertDialogAction>
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

      <Dialog
        open={viewingNote !== null}
        onOpenChange={(open) => {
          if (!open) setViewingNote(null)
        }}
      >
        {viewingNote && (
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader className="pr-8">
              <DialogTitle className="break-words text-xl">{viewingNote.title}</DialogTitle>
              <DialogDescription>Created {new Date(viewingNote.createdAt).toLocaleString()}</DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-muted/30 p-4">
              <p className="whitespace-pre-wrap break-words leading-7">{viewingNote.content}</p>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit Your Note' : 'Create a Note'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveNote} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-title">Title</Label>
              <Input id="note-title" maxLength={120} required value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-content">Content</Label>
              <Textarea id="note-content" maxLength={10000} required value={content} onChange={(event) => setContent(event.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>{submitting ? 'Please Wait...' : 'Save Note'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
