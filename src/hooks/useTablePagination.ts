'use client'

import { useCallback, useState } from 'react'

export function useTablePagination(initialPageSize = 10) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const changePage = useCallback((nextPage: number, nextPageSize: number) => {
    setPage(nextPageSize === pageSize ? nextPage : 1)
    setPageSize(nextPageSize)
  }, [pageSize])

  const resetPage = useCallback(() => setPage(1), [])

  return { page, pageSize, setPage, changePage, resetPage }
}
