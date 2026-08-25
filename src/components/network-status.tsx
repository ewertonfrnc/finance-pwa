import { useNetworkStatus } from '../lib/use-network-status'

export function NetworkStatus() {
  const isOnline = useNetworkStatus()

  if (isOnline) {
    return null
  }

  return (
    <output className="relative z-50 bg-warning px-4 py-2 text-center text-sm font-medium text-warning-ink">
      Sem conexão. Você pode abrir o app, mas dados financeiros exigem internet.
    </output>
  )
}
