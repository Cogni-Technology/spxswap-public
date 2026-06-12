import type { InAppNotification } from '@universe/api'
// Stubbed — Uniswap promo banners (Solana launch, zero fees) not applicable to SPXSwap.
// Original imported a 4.2 MB Solana banner dark PNG and other promo images.
import { type NotificationDataSource } from '@universe/notifications'

interface CreateLegacyBannersNotificationDataSourceContext {
  tracker: unknown
  pollIntervalMs?: number
  getIsDarkMode: () => boolean
}

export function createLegacyBannersNotificationDataSource(
  _ctx: CreateLegacyBannersNotificationDataSourceContext,
): NotificationDataSource {
  return {
    start(_callback: (notifications: InAppNotification[], source: string) => void): void {
      // no-op: no legacy banners in SPXSwap
    },
    async stop(): Promise<void> {
      // no-op
    },
  }
}
