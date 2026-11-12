import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/context/AuthContext'
import { notifyError, request } from '@/lib/api'
import type { CursorPaginatedResponse, Post, PostFeedItem } from '@/types'

export function Posts() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<PostFeedItem[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<PostFeedItem | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submittingPost, setSubmittingPost] = useState(false)
  const cursorRef = useRef<string | null>(null)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return

    loadingRef.current = true
    setFeedLoading(true)
    setFeedError(null)

    const params = new URLSearchParams({ limit: '10' })
    if (cursorRef.current) params.set('cursor', cursorRef.current)

    try {
      const result = await request<CursorPaginatedResponse<PostFeedItem>>(`/posts?${params}`)
      setPosts((current) => {
        const existingIds = new Set(current.map((post) => post._id))
        return [...current, ...result.data.filter((post) => !existingIds.has(post._id))]
      })
      cursorRef.current = result.pagination.nextCursor
      hasMoreRef.current = result.pagination.hasMore
      setHasMore(result.pagination.hasMore)
    } catch (cause) {
      setFeedError(cause instanceof Error ? cause.message : 'Could not load posts.')
      notifyError(cause)
    } finally {
      loadingRef.current = false
      setFeedLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadNextPage()
  }, [loadNextPage])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (
      !sentinel ||
      !hasMore ||
      feedLoading ||
      feedError ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadNextPage()
      },
      { rootMargin: '320px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [feedError, feedLoading, hasMore, loadNextPage])

  const openCreatePost = () => {
    setEditingPost(null)
    setTitle('')
    setContent('')
    setDialogOpen(true)
  }

  const openEditPost = (post: PostFeedItem) => {
    setEditingPost(post)
    setTitle(post.title)
    setContent(post.content)
    setDialogOpen(true)
  }

  const savePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !content.trim()) return

    setSubmittingPost(true)
    try {
      const body = { title: title.trim(), content }
      if (editingPost) {
        const updatedPost = await request<Post>(
          `/posts/${encodeURIComponent(editingPost._id)}`,
          { method: 'PATCH', body },
        )
        setPosts((current) => current.map((post) => (
          post._id === editingPost._id
            ? { ...post, ...updatedPost, author: post.author }
            : post
        )))
        toast.success('Post updated.')
      } else {
        const createdPost = await request<PostFeedItem>('/posts', { method: 'POST', body })
        setPosts((current) => [
          createdPost,
          ...current.filter((post) => post._id !== createdPost._id),
        ])
        toast.success('Post published.')
      }

      setDialogOpen(false)
      setEditingPost(null)
      setTitle('')
      setContent('')
    } catch (cause) {
      notifyError(cause)
    } finally {
      setSubmittingPost(false)
    }
  }

  const deletePost = async (post: PostFeedItem) => {
    try {
      await request<void>(`/posts/${encodeURIComponent(post._id)}`, { method: 'DELETE' })
      setPosts((current) => current.filter((item) => item._id !== post._id))
      toast.success('Post deleted.')
    } catch (cause) {
      notifyError(cause)
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Community"
        title="Posts"
        description="Read what the community is sharing, or add a post of your own."
        action={<Button type="button" onClick={openCreatePost}>Create Post</Button>}
      />

      <section aria-label="Community feed" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Latest Posts</h2>
          {posts.length > 0 && (
            <p className="text-sm text-muted-foreground">{posts.length.toLocaleString()} loaded</p>
          )}
        </div>

        {feedError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{feedError}</p>}
        {!feedLoading && !feedError && posts.length === 0 && (
          <Card className="items-center border-dashed py-10 text-center">
            <CardTitle>No Posts Yet</CardTitle>
            <CardDescription>Be the first to share something with the community.</CardDescription>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {posts.map((post) => {
            const isAuthor = post.author._id === user?._id

            return (
              <Card key={post._id} className="h-full">
                <CardHeader className="border-b pb-4">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground">
                        {post.author.name.trim().charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 space-y-1">
                        <p className="truncate font-medium">{post.author.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {post.createdAt ? new Date(post.createdAt).toLocaleString() : ''}
                        </p>
                      </div>
                    </div>
                    {isAuthor && (
                      <div className="flex shrink-0 items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openEditPost(post)}>
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive" size="sm">Delete</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete This Post?</AlertDialogTitle>
                              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" onClick={() => void deletePost(post)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <h3 className="break-words text-lg font-semibold">{post.title}</h3>
                  <p className="whitespace-pre-wrap break-words leading-7">{post.content}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {feedLoading && (
          <p role="status" className="py-4 text-center text-sm text-muted-foreground">
            Loading posts...
          </p>
        )}
        {hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-2">
            <Button type="button" variant="outline" onClick={() => void loadNextPage()} disabled={feedLoading}>
              {feedLoading ? 'Loading Posts...' : feedError ? 'Retry Loading' : 'Load More'}
            </Button>
          </div>
        )}
        {!hasMore && posts.length > 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">You’re all caught up.</p>
        )}
      </section>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingPost(null)
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingPost ? 'Edit Post' : 'Create a Post'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={savePost} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="post-title">Title</Label>
              <Input
                id="post-title"
                maxLength={120}
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-content">Content</Label>
              <Textarea
                id="post-content"
                className="max-h-[45vh] resize-y"
                maxLength={10000}
                required
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingPost}>
                {submittingPost ? 'Please Wait...' : editingPost ? 'Save Changes' : 'Publish Post'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
