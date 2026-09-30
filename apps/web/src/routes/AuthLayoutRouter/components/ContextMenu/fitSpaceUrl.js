/** Fits a space URL to maxWidth. The full URL is returned when it fits; otherwise the host stays and the tail is kept, with an ellipsis between them. */
export function fitSpaceUrl (fullUrl, maxWidth, measure) {
  if (maxWidth <= 0 || measure(fullUrl) <= maxWidth) return fullUrl

  const prefix = 'hylo.com/…'
  let low = 0
  let high = fullUrl.length
  let bestLength = 0

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const candidate = prefix + fullUrl.slice(fullUrl.length - mid)
    if (measure(candidate) <= maxWidth) {
      bestLength = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  let tail = fullUrl.slice(fullUrl.length - bestLength)
  // Drop a partial path segment so the ellipsis lands on a slash: hylo.com/…/spaces/slug
  if (tail && !tail.startsWith('/')) {
    const slash = tail.indexOf('/')
    if (slash !== -1) tail = tail.slice(slash)
  }

  return prefix + tail
}
