import { useSyncExternalStore } from 'react'
import { isDefaultGroupAvatar } from 'util/groupInitials'

const SIZE = 42
const cache = new Map()
const pending = new Set()
let version = 0
const listeners = new Set()

/** Bumps when a circular avatar finishes loading so map layers can rebuild. */
function emit () {
  version += 1
  listeners.forEach(listener => listener())
}

/** Subscribes to circular avatar loads. */
function subscribe (listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Re-renders when a square avatar has been clipped to a circle. */
export function useCircularMarkerVersion () {
  return useSyncExternalStore(subscribe, () => version, () => 0)
}

/**
 * Circular data URL for a group avatar, or null until the image has loaded.
 * Starts the load as a side effect.
 */
export function circularMarkerDataUrl (url) {
  if (!url || url.startsWith('data:')) return url || null
  if (cache.has(url)) return cache.get(url)
  if (typeof document !== 'undefined' && !pending.has(url)) loadCircularMarker(url)
  return null
}

/** Loads an avatar and caches a 42px circle with the same hairline stroke as -forMap.png. */
function loadCircularMarker (url) {
  pending.add(url)
  const image = new window.Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => {
    pending.delete(url)
    cache.set(url, drawCircularMarker(image))
    emit()
  }
  image.onerror = () => {
    pending.delete(url)
    cache.set(url, null)
    emit()
  }
  image.src = url
}

/** Draws the image cover-cropped into a circle. Returns null if the canvas is unreadable. */
function drawCircularMarker (image) {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  const radius = SIZE / 2 - 0.5
  ctx.save()
  ctx.beginPath()
  ctx.arc(SIZE / 2, SIZE / 2, radius, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  const scale = Math.max(SIZE / image.width, SIZE / image.height)
  const width = image.width * scale
  const height = image.height * scale
  ctx.drawImage(image, (SIZE - width) / 2, (SIZE - height) / 2, width, height)
  ctx.restore()
  ctx.beginPath()
  ctx.arc(SIZE / 2, SIZE / 2, radius, 0, Math.PI * 2)
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 1
  ctx.stroke()
  try {
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

/**
 * Picks the map icon for a group avatar.
 * Pre-cut -forMap.png files are already circles. Other uploads are clipped in the browser,
 * and initials stand in until that clip is ready so a square photo never lands on the map.
 */
export function markerUrlForAvatar (avatarUrl, name, initialsUrl) {
  if (isDefaultGroupAvatar(avatarUrl)) return initialsUrl
  if (avatarUrl.includes('-forMap.')) return avatarUrl
  return circularMarkerDataUrl(avatarUrl) || initialsUrl
}
