export interface PaginationOptions {
  defaultPageSize?: number
  maxPageSize?: number
}

export interface Pagination {
  page: number
  pageSize: number
}

function parsePositiveInteger(value: string | null, fallback: number): number | null {
  if (value === null) return fallback
  if (!/^\d+$/.test(value)) return null

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

export function parsePagination(
  searchParams: URLSearchParams,
  options: PaginationOptions = {}
): Pagination | null {
  const defaultPageSize = options.defaultPageSize ?? 10
  const maxPageSize = options.maxPageSize ?? 100
  const page = parsePositiveInteger(searchParams.get('page'), 1)
  const pageSize = parsePositiveInteger(searchParams.get('pageSize'), defaultPageSize)

  if (page === null || pageSize === null || pageSize > maxPageSize) return null
  return { page, pageSize }
}
