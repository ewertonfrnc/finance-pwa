import { createRootRouteWithContext } from '@tanstack/react-router'

import { NotFoundPage, RootLayout } from '../app/root-layout'
import type { RouterContext } from '../app/router-context'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})
