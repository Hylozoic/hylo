/**
 * YouTube video id from a watch, shorts, embed, live, or youtu.be URL.
 */
function getYoutubeId (url) {
  const match = url.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i
  )
  return match?.[1] || null
}

/**
 * Vimeo video id and optional unlisted privacy hash from a watch or player URL.
 * Unlisted share URLs look like https://vimeo.com/921819912/06e3f813av
 */
function getVimeoEmbedParts (url) {
  const playerMatch = url.match(/player\.vimeo\.com\/video\/(\d+)(?:\/([a-zA-Z0-9]+))?/i)
  const unlistedMatch = !playerMatch && url.match(/vimeo\.com\/(\d+)\/([a-zA-Z0-9]+)/i)
  const watchMatch = !playerMatch && !unlistedMatch && url.match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/)?(\d+)/i)

  const id = playerMatch?.[1] || unlistedMatch?.[1] || watchMatch?.[1]
  if (!id) return null

  const pathHash = playerMatch?.[2] || unlistedMatch?.[2] || null
  const queryHash = url.match(/[?&]h=([a-zA-Z0-9]+)/)?.[1] || null

  return { id, hash: pathHash || queryHash || null }
}

/**
 * Returns a YouTube/Vimeo iframe src for a featured video URL, or null.
 * Used instead of ReactPlayer so embeds do not depend on Vite ESM interop.
 */
export function getVideoEmbedUrl (url) {
  if (!url || typeof url !== 'string') return null
  const youtubeId = getYoutubeId(url)
  if (youtubeId) return `https://www.youtube.com/embed/${youtubeId}`
  const vimeo = getVimeoEmbedParts(url)
  if (vimeo) {
    const hashQuery = vimeo.hash ? `?h=${vimeo.hash}` : ''
    return `https://player.vimeo.com/video/${vimeo.id}${hashQuery}`
  }
  return null
}

/**
 * Returns true when a link-preview URL should render as an embedded video.
 */
export default function isPlayableVideoUrl (url) {
  return !!getVideoEmbedUrl(url)
}
