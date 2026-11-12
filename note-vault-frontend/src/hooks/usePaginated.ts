import { useCallback, useEffect, useState } from 'react'
import { notifyError } from '@/lib/api'
import type { PaginatedResponse, Pagination } from '@/types'

interface PaginatedState<T> {
  page: number
  data: T[]
  pagination: Pagination | null
  loading: boolean
  error: string | null
  setPage: (page: number) => void
  reload: () => void
}

export function usePaginated<T>(
  loadPage: (page: number) => Promise<PaginatedResponse<T>>,
): PaginatedState<T> {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<T[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    loadPage(page)
      .then((result) => {
        if (!active) return
        if (result.data.length === 0 && page > 1) {
          setPage(page - 1)
          return
        }
        setData(result.data)
        setPagination(result.pagination)
      })
      .catch((cause: unknown) => {
        if (!active) return
        const message = cause instanceof Error ? cause.message : 'Could not load data.'
        setError(message)
        notifyError(cause)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [loadPage, page, reloadKey])

  return { page, data, pagination, loading, error, setPage, reload }
}
