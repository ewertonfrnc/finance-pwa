import type { QueryClient } from '@tanstack/react-query'

import type { ResolvedAuthSession } from '../features/auth/auth-session'

export type RouterContext = {
  auth: ResolvedAuthSession
  queryClient: QueryClient
}
