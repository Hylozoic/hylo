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
 * Numeric Vimeo id from a watch, player, or channel URL.
 */
function getVimeoId (url) {
  const match = url.match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/)?(\d+)/i)
  return match?.[1] || null
}

/**
 * Returns a YouTube/Vimeo iframe src for a featured video URL, or null.
 * Used instead of ReactPlayer so embeds do not depend on Vite ESM interop.
 */
export function getVideoEmbedUrl (url) {
  if (!url || typeof url !== 'string') return null
  const youtubeId = getYoutubeId(url)
  if (youtubeId) return `https://www.youtube.com/embed/${youtubeId}`
  const vimeoId = getVimeoId(url)
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`
  return null
}

/**
 * Returns true when a link-preview URL should render as an embedded video.
 */
export default function isPlayableVideoUrl (url) {
  return !!getVideoEmbedUrl(url)
}
