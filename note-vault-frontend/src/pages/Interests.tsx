import { useCallback, useState, type FormEvent } from 'react'
import { ArrowRight, Search, Users } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { PaginationControls } from '@/components/PaginationControls'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { request } from '@/lib/api'
import { usePaginated } from '@/hooks/usePaginated'
import type { InterestGroup, InterestMember, PaginatedResponse } from '@/types'

export function Interests() {
  const [interestInput, setInterestInput] = useState('')
  const [filter, setFilter] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<InterestGroup | null>(null)

  const loadPage = useCallback(async (page: number): Promise<PaginatedResponse<InterestGroup>> => {
    const params = new URLSearchParams({ page: String(page), limit: '10' })
    if (filter) params.set('interest', filter)
    return request<PaginatedResponse<InterestGroup>>(`/interests/groups?${params}`)
  }, [filter])

  const { page, data, pagination, loading, error, setPage } = usePaginated(loadPage)

  const applyFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setFilter(interestInput.trim())
  }

  const clearFilter = () => {
    setInterestInput('')
    setPage(1)
    setFilter('')
  }

  const groupTotal = pagination?.total ?? data.length

  return (
    <section className="space-y-7">
      <PageHeader
        eyebrow="Community"
        title="Interest Groups"
        description="Find people who share your interests and see what the community is talking about."
      />

      <Card>
        <CardHeader>
          <CardTitle>Find an Interest</CardTitle>
          <CardDescription>Search by exact interest name, or leave the field empty to browse all groups.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={applyFilter} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="interest-filter">Interest</Label>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="interest-filter"
                  className="pl-9"
                  maxLength={30}
                  placeholder="e.g. photography"
                  value={interestInput}
                  onChange={(event) => setInterestInput(event.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 sm:flex-initial">Search Groups</Button>
              {filter && (
                <Button type="button" variant="outline" onClick={clearFilter}>
                  Clear
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">Browse Groups</h2>
            {filter && <p className="mt-1 text-sm text-muted-foreground">Results for “{filter}”</p>}
          </div>
          {!loading && !error && (
            <p className="text-sm text-muted-foreground">
              {groupTotal.toLocaleString()} {groupTotal === 1 ? 'group' : 'groups'}
            </p>
          )}
        </div>

        {loading && (
          <p role="status" className="rounded-lg border bg-card px-4 py-6 text-center text-muted-foreground">
            Loading interest groups...
          </p>
        )}
        {!loading && error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-destructive">
            {error}
          </p>
        )}
        {!loading && !error && data.length === 0 && (
          <Card className="items-center border-dashed py-10 text-center">
            <Users aria-hidden="true" className="h-8 w-8 text-muted-foreground" />
            <CardTitle>No Groups Found</CardTitle>
            <CardDescription>
              {filter ? 'Try another interest name, or clear the search to browse all groups.' : 'There are no interest groups to show yet.'}
            </CardDescription>
          </Card>
        )}

        {!loading && !error && data.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {data.map((group) => {
              const additionalMembers = Math.max(group.count - group.users.length, 0)

              return (
                <Card key={group.interest} className="h-full">
                  <CardHeader className="gap-3 border-b pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="min-w-0 break-words text-lg">{group.interest}</CardTitle>
                      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-primary">
                        <Users aria-hidden="true" className="h-4 w-4" />
                        <span className="font-semibold tabular-nums">{group.count.toLocaleString()}</span>
                      </span>
                    </div>
                    <CardDescription>
                      {group.count === 1 ? '1 person shares this interest' : `${group.count.toLocaleString()} people share this interest`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3 pt-1">
                    {group.users.length > 0 ? (
                      <ul aria-label={`Member preview for ${group.interest}`} className="space-y-1">
                        {group.users.map((member) => (
                          <li key={member._id} className="flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5 text-sm">
                            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground">
                              {member.name.trim().charAt(0).toUpperCase()}
                            </span>
                            <span className="truncate font-medium">{member.name}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="py-2 text-sm text-muted-foreground">No member preview available.</p>
                    )}
                    {additionalMembers > 0 && (
                      <p className="px-2 text-xs text-muted-foreground">
                        +{additionalMembers.toLocaleString()} more {additionalMembers === 1 ? 'member' : 'members'}
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-auto w-full justify-between"
                      aria-label={`Browse ${group.count.toLocaleString()} members in ${group.interest}`}
                      onClick={() => setSelectedGroup(group)}
                    >
                      Browse Members
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <PaginationControls pagination={pagination} page={page} loading={loading} onPageChange={setPage} />

      <Dialog
        open={selectedGroup !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedGroup(null)
        }}
      >
        {selectedGroup && <InterestMembersDialog key={selectedGroup.interest} group={selectedGroup} />}
      </Dialog>
    </section>
  )
}

function InterestMembersDialog({ group }: { group: InterestGroup }) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const loadMembers = useCallback(async (page: number): Promise<PaginatedResponse<InterestMember>> => {
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    return request<PaginatedResponse<InterestMember>>(
      `/interests/groups/${encodeURIComponent(group.interest)}/members?${params}`,
    )
  }, [group.interest, search])

  const { page, data, pagination, loading, error, setPage } = usePaginated(loadMembers)

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  const clearSearch = () => {
    setSearchInput('')
    setPage(1)
    setSearch('')
  }

  const memberTotal = pagination?.total ?? group.count

  return (
    <DialogContent className="grid h-[min(85vh,40rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-4 overflow-hidden sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="pr-8 break-words">{group.interest}</DialogTitle>
        <DialogDescription>
          Browse {group.count.toLocaleString()} members. Search by name and view results in pages.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={applySearch} className="space-y-2">
        <Label htmlFor="member-search">Search Members</Label>
        <div className="flex min-w-0 gap-2">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="member-search"
              className="pl-9"
              maxLength={60}
              placeholder="Type a name"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <Button type="submit">Search Members</Button>
          {search && (
            <Button type="button" variant="outline" onClick={clearSearch}>
              Clear
            </Button>
          )}
        </div>
      </form>

      <div className="flex min-h-0 flex-col gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loading
            ? 'Loading member results...'
            : `${memberTotal.toLocaleString()} ${memberTotal === 1 ? 'member' : 'members'}${search ? ` matching “${search}”` : ''}`}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
          {loading && <p role="status" className="px-4 py-8 text-center text-sm text-muted-foreground">Loading members...</p>}
          {!loading && error && <p role="alert" className="px-4 py-8 text-center text-sm text-destructive">{error}</p>}
          {!loading && !error && data.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {search ? 'No members match that name.' : 'No members found in this group.'}
            </p>
          )}
          {!loading && !error && data.length > 0 && (
            <ul aria-label={`Members in ${group.interest}`} className="divide-y">
              {data.map((member) => (
                <li key={member._id} className="flex min-w-0 items-center gap-3 px-3 py-2.5 text-sm">
                  <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground">
                    {member.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate font-medium">{member.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <PaginationControls pagination={pagination} page={page} loading={loading} onPageChange={setPage} />
    </DialogContent>
  )
}
