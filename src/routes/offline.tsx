import { createFileRoute } from '@tanstack/react-router'

import { OfflinePage } from '../features/offline/offline-page'

export const Route = createFileRoute('/offline')({
  component: OfflinePage,
})
