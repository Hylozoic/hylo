// Expo dev client launch URLs must not be re-opened — that restarts MainActivity and loops.
export default function shouldStoreInitialURL (url: string | null): url is string {
  if (!url) return false
  if (url.startsWith('exp+') || url.startsWith('expo://')) return false
  if (url.includes('expo-development-client')) return false
  return true
}
