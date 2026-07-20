import React from 'react'
import { icons } from 'lucide-react'

/** Maps legacy Hylo icon font names to Lucide component names. */
const HYLO_TO_LUCIDE = {
  Filter: 'ListFilter',
  Stack: 'Layers'
}

/** Resolve a stored icon name to a valid Lucide export, if possible. */
function resolveLucideIconName (name) {
  if (!name) return null
  if (icons[name]) return name
  const mapped = HYLO_TO_LUCIDE[name]
  if (mapped && icons[mapped]) return mapped
  return null
}

/** Renders a Lucide icon by PascalCase name, with optional fallback when unknown. */
export default function LucideIcon ({ name, className, fallback = null }) {
  const resolved = resolveLucideIconName(name)
  if (!resolved) return fallback
  const Icon = icons[resolved]
  return <Icon className={className} />
}
