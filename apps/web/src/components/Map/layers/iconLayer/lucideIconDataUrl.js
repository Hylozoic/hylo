import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { icons } from 'lucide-react'

const ICON_CACHE = new Map()
const MAP_ICON_SIZE = 42
const INNER_ICON_SIZE = 22

/**
 * Builds a circular map-marker data URL for a Lucide icon (same asset size as group avatars).
 * @param {string} name - PascalCase Lucide icon name
 * @returns {string|null}
 */
export function lucideIconDataUrl (name) {
  const iconName = name && icons[name] ? name : 'Circle'
  if (ICON_CACHE.has(iconName)) return ICON_CACHE.get(iconName)

  const Icon = icons[iconName]
  const iconSvg = renderToStaticMarkup(
    React.createElement(Icon, {
      size: INNER_ICON_SIZE,
      color: '#1e293b',
      strokeWidth: 2
    })
  )
  // Lucide puts fill/stroke on the root <svg>; those are lost when we unwrap
  // the paths, and SVG defaults fill to black — reapply stroke styling on <g>.
  const inner = iconSvg
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '')
  const offset = (MAP_ICON_SIZE - INNER_ICON_SIZE) / 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_ICON_SIZE}" height="${MAP_ICON_SIZE}" viewBox="0 0 ${MAP_ICON_SIZE} ${MAP_ICON_SIZE}">` +
    `<circle cx="${MAP_ICON_SIZE / 2}" cy="${MAP_ICON_SIZE / 2}" r="${MAP_ICON_SIZE / 2 - 1}" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>` +
    `<g transform="translate(${offset}, ${offset})" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>` +
    '</svg>'

  const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  ICON_CACHE.set(iconName, dataUrl)
  return dataUrl
}
