import { createRouter } from '@tanstack/react-router'

import { routeTree } from '../routeTree.gen'
import { queryClient } from './query-client'

export const router = createRouter({
  routeTree,
  context: {
    auth: { session: null, status: 'anonymous' },
    queryClient,
  },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
