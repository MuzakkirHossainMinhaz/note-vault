import { useCallback, useEffect, useState, type FormEvent } from 'react'
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
import { usePaginated } from '@/hooks/usePaginated'
import { notifyError, request } from '@/lib/api'
import { getOwnerId } from '@/lib/utils'
import type { Note, PaginatedResponse, User } from '@/types'
import { Check, ChevronDown } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'

export function AdminNotes() {
  const { user } = useAuth()
  const [ownerOptions, setOwnerOptions] = useState<User[]>([])
  const [ownerPage, setOwnerPage] = useState(1)
  const [selectedOwner, setSelectedOwner] = useState<User | null>(null)
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false)
  const [ownersLoading, setOwnersLoading] = useState(false)
  const [ownersHaveMore, setOwnersHaveMore] = useState(false)
  const [ownersError, setOwnersError] = useState<string | null>(null)
  const [ownerFilter, setOwnerFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [viewingNote, setViewingNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadPage = useCallback(async (page: number): Promise<PaginatedResponse<Note>> => {
    const params = new URLSearchParams({ page: String(page), limit: '10' })
    if (ownerFilter) params.set('owner', ownerFilter)
    return request<PaginatedResponse<Note>>(`/notes?${params}`)
  }, [ownerFilter])

  const { page, data, pagination, loading, error, setPage, reload } = usePaginated(loadPage)

  useEffect(() => {
    let active = true
    const loadOwners = async () => {
      setOwnersLoading(true)
      setOwnersError(null)
      try {
        const params = new URLSearchParams({ page: String(ownerPage), limit: '20' })
        const result = await request<PaginatedResponse<User>>(`/users?${params}`)
        if (!active) return
        setOwnerOptions((current) => ownerPage === 1
          ? result.data
          : [...current, ...result.data.filter((owner) => !current.some((item) => item._id === owner._id))])
        setOwnersHaveMore(result.pagination.hasNextPage)
      } catch (cause) {
        if (!active) return
        setOwnersError(cause instanceof Error ? cause.message : 'Could not load owners.')
        notifyError(cause)
      } finally {
        if (active) setOwnersLoading(false)
      }
    }

    void loadOwners()

    return () => {
      active = false
    }
  }, [ownerPage])

  const applyFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setOwnerFilter(selectedOwner?._id ?? '')
  }

  const clearFilter = () => {
    setSelectedOwner(null)
    setOwnerFilter('')
    setPage(1)
  }

  const selectableOwners = selectedOwner && !ownerOptions.some((owner) => owner._id === selectedOwner._id)
    ? [selectedOwner, ...ownerOptions]
    : ownerOptions

  const openEditNote = (note: Note) => {
    setEditingNote(note)
    setTitle(note.title)
    setContent(note.content)
    setDialogOpen(true)
  }

  const saveNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingNote || !title.trim() || !content.trim()) return
    setSubmitting(true)
    try {
      await request(`/notes/${encodeURIComponent(editingNote._id)}`, {
        method: 'PATCH',
        body: { title, content },
      })
      toast.success('Note updated.')
      setDialogOpen(false)
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
        eyebrow="Administration"
        title="Admin Notes"
        description="Review and manage notes across the community."
      />
      <form onSubmit={applyFilter} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="owner-picker">Filter By Owner</Label>
          <PopoverPrimitive.Root open={ownerPickerOpen} onOpenChange={setOwnerPickerOpen}>
            <PopoverPrimitive.Trigger asChild>
              <Button
                id="owner-picker"
                type="button"
                variant="outline"
                size="lg"
                role="combobox"
                aria-expanded={ownerPickerOpen}
                aria-controls="owner-options"
                className="w-full justify-between font-normal"
              >
                <span className="truncate">
                  {selectedOwner ? `${selectedOwner.name} (${selectedOwner.email})` : 'All Owners'}
                </span>
                <ChevronDown className="ml-2 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                align="start"
                sideOffset={4}
                className="z-50 w-[var(--radix-popover-trigger-width)] rounded-md border bg-popover text-popover-foreground shadow-md"
              >
                <div className="flex items-center gap-2 border-b px-3">
                  <p className="py-3 text-sm font-medium">Select an owner</p>
                </div>
                <div id="owner-options" role="listbox" aria-label="Owners" className="max-h-64 overflow-y-auto p-1">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedOwner === null}
                    onClick={() => {
                      setSelectedOwner(null)
                      setOwnerPickerOpen(false)
                    }}
                    className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    All Owners
                    <Check className={`size-4 ${selectedOwner === null ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
                  </button>
                  {ownersLoading && <p className="px-2 py-3 text-sm text-muted-foreground">Loading Owners...</p>}
                  {!ownersLoading && !ownersError && selectableOwners.length === 0 && (
                    <p className="px-2 py-3 text-sm text-muted-foreground">No Owners Found</p>
                  )}
                  {!ownersLoading && selectableOwners.map((owner) => (
                    <button
                      key={owner._id}
                      type="button"
                      role="option"
                      aria-selected={selectedOwner?._id === owner._id}
                      onClick={() => {
                        setSelectedOwner(owner)
                        setOwnerPickerOpen(false)
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{owner.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{owner.email}</span>
                      </span>
                      <Check className={`size-4 shrink-0 ${selectedOwner?._id === owner._id ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                {ownersHaveMore && (
                  <div className="border-t p-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={ownersLoading}
                      onClick={() => setOwnerPage((current) => current + 1)}
                    >
                      {ownersLoading ? 'Loading Owners...' : 'Load More Owners'}
                    </Button>
                  </div>
                )}
                {ownersError && <p role="alert" className="border-t px-3 py-2 text-xs text-destructive">{ownersError}</p>}
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
        </div>
        <div className="flex items-center gap-2 md:justify-end">
          <Button type="submit" className="h-9 flex-1 md:flex-initial">Filter Notes</Button>
          <Button type="button" variant="outline" className="h-9" onClick={clearFilter}>Clear Filter</Button>
        </div>
        {ownersError && !ownerPickerOpen && (
          <p role="alert" className="text-xs text-destructive md:col-span-2">{ownersError}</p>
        )}
      </form>

      {loading && <p className="text-muted-foreground">Loading notes...</p>}
      {!loading && error && <p role="status">{error}</p>}
      {!loading && !error && data.length === 0 && <p className="text-muted-foreground">No notes found.</p>}
      {data.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableCaption className="sr-only">Admin Notes With Owner Information</TableCaption>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Title</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="hidden whitespace-nowrap lg:table-cell">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((note) => {
                  const ownNote = Boolean(user && getOwnerId(note.owner) === user._id)
                  const ownerName = typeof note.owner === 'string' ? 'Unknown Owner' : note.owner.name
                  const ownerDetails = typeof note.owner === 'string' ? `Owner ID: ${note.owner}` : note.owner.email

                  return (
                    <TableRow key={note._id}>
                      <TableCell className="max-w-48">
                        <p className="max-w-48 truncate font-medium">{note.title}</p>
                      </TableCell>
                      <TableCell className="max-w-64">
                        <p className="max-w-64 truncate text-muted-foreground">{note.content}</p>
                      </TableCell>
                      <TableCell className="max-w-56">
                        <div className="max-w-56 space-y-0.5">
                          <p className="truncate font-medium">{ownerName}</p>
                          <p className="truncate text-xs text-muted-foreground" title={ownerDetails}>{ownerDetails}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">
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
                          {ownNote && (
                            <>
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
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
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
              <DialogDescription>
                {typeof viewingNote.owner === 'string'
                  ? `Owner ID: ${viewingNote.owner}`
                  : `Owned by ${viewingNote.owner.name} (${viewingNote.owner.email})`}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-muted/30 p-4">
              <p className="whitespace-pre-wrap break-words leading-7">{viewingNote.content}</p>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Your Note</DialogTitle></DialogHeader>
          <form onSubmit={saveNote} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-note-title">Title</Label>
              <Input id="admin-note-title" maxLength={120} required value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-note-content">Content</Label>
              <Textarea id="admin-note-content" maxLength={10000} required value={content} onChange={(event) => setContent(event.target.value)} />
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
