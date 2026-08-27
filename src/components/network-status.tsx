import { useNetworkStatus } from '../lib/use-network-status'

export function NetworkStatus() {
  const isOnline = useNetworkStatus()

  if (isOnline) {
    return null
  }

  return (
    <output className="finance-safe-top finance-safe-x relative z-50 block bg-warning text-center text-sm font-medium text-warning-ink">
      <span className="block px-4 py-2">
        Sem conexão. Você pode abrir o app, mas dados financeiros exigem
        internet.
      </span>
    </output>
  )
}
