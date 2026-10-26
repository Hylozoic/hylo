import React from 'react'
import { resolveLucideIcon, useLucideIcons } from './lucideIconSet'

/** Renders a Lucide icon by PascalCase name, with optional fallback when unknown. */
export default function LucideIcon ({ name, className, fallback = null }) {
  useLucideIcons()
  const Icon = resolveLucideIcon(name)
  if (!Icon) return fallback
  return <Icon className={className} />
}
