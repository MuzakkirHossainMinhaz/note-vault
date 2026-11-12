import { Button } from '@/components/ui/button'
import type { Pagination } from '@/types'

interface PaginationControlsProps {
  pagination: Pagination | null
  page: number
  loading: boolean
  onPageChange: (page: number) => void
}

export function PaginationControls({
  pagination,
  page,
  loading,
  onPageChange,
}: PaginationControlsProps) {
  if (!pagination) return null

  const pageLabel = pagination.totalPages
    ? `Page ${pagination.page} of ${pagination.totalPages}`
    : `Page ${pagination.page}`

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-4 py-4">
      <Button
        type="button"
        variant="outline"
        disabled={loading || !pagination.hasPrevPage}
        onClick={() => onPageChange(page - 1)}
      >
        Prev
      </Button>
      <span className="text-sm text-muted-foreground" aria-live="polite">
        {pageLabel}
      </span>
      <Button
        type="button"
        variant="outline"
        disabled={loading || !pagination.hasNextPage}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </nav>
  )
}
