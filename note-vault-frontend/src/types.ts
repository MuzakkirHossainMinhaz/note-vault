export type Role = 'user' | 'admin'

export interface User {
  _id: string
  name: string
  email: string
  role: Role
  interests: string[]
}

export interface Note {
  _id: string
  title: string
  content: string
  owner: string | Pick<User, '_id' | 'name' | 'email'>
  createdAt: string
}

export interface Pagination {
  page: number
  limit: number
  total?: number
  totalPages?: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: Pagination
}

export interface InterestGroup {
  interest: string
  count: number
  users: InterestMember[]
}

export type InterestMember = Pick<User, '_id' | 'name'>

export interface Post {
  _id: string
  title: string
  content: string
  createdAt?: string
}

export interface PostFeedItem extends Post {
  author: Pick<User, '_id' | 'name'>
  createdAt: string
}

export interface CursorPagination {
  nextCursor: string | null
  hasMore: boolean
}

export interface CursorPaginatedResponse<T> {
  data: T[]
  pagination: CursorPagination
}

export interface UserPostsResponse {
  user: Pick<User, '_id' | 'name'>
  posts: Post[]
  pagination: Pagination
}

export interface ApiError {
  status: number
  message: string
  details?: unknown
}

export interface ApiErrorPayload {
  message: string
  details?: unknown
}

export interface ApiErrorResponse {
  error?: ApiErrorPayload
}

export interface ValidationDetail {
  path?: string
  message: string
}
