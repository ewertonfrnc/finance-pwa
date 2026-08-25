import { useRegisterSW } from 'virtual:pwa-register/react'

import { PwaUpdateDialog } from './pwa-update-dialog'

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  if (needRefresh) {
    return (
      <PwaUpdateDialog
        kind="update"
        onAccept={() => void updateServiceWorker(true)}
        onDismiss={() => setNeedRefresh(false)}
      />
    )
  }

  if (offlineReady) {
    return (
      <PwaUpdateDialog
        kind="offline-ready"
        onAccept={() => setOfflineReady(false)}
        onDismiss={() => setOfflineReady(false)}
      />
    )
  }

  return null
}
