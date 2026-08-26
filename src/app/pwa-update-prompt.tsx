import { useRegisterSW } from 'virtual:pwa-register/react'

import { useUnsavedChanges } from './unsaved-changes'
import { PwaUpdateDialog } from './pwa-update-dialog'

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()
  const { hasUnsavedChanges } = useUnsavedChanges()

  if (needRefresh) {
    return (
      <PwaUpdateDialog
        hasUnsavedChanges={hasUnsavedChanges}
        kind="update"
        onAccept={() => void updateServiceWorker(true)}
        onDismiss={() => setNeedRefresh(false)}
      />
    )
  }

  if (offlineReady) {
    return (
      <PwaUpdateDialog
        hasUnsavedChanges={false}
        kind="offline-ready"
        onAccept={() => setOfflineReady(false)}
        onDismiss={() => setOfflineReady(false)}
      />
    )
  }

  return null
}
