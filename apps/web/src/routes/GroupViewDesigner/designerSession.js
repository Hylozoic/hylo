import { useSyncExternalStore } from 'react'

/**
 * The state of one "Design your own view" session, shared by the chat column
 * (which replaces the group menu) and the canvas in the main column. The two
 * are mounted in different parts of the layout, so the session lives here
 * instead of in either component.
 *
 * A session is kept per group and view ('new' for a page not saved yet) for
 * as long as the tab is open, so leaving the designer and coming back does
 * not lose an unsaved design. Nothing here is stored on the server.
 */

const sessions = new Map()
const listeners = new Set()

export const EMPTY_USAGE_TOTAL = { count: 0, tokens: 0, costUsd: 0, costKnown: true }

function emptySession () {
  return {
    // [{ role: 'user' | 'assistant', text }]
    messages: [],
    // The page as building blocks, or null before the first design
    design: null,
    name: '',
    // Whether the design differs from what is saved
    dirty: false,
    sending: false,
    saving: false,
    error: null,
    lastUsage: null,
    usageTotal: EMPTY_USAGE_TOTAL,
    // True once an existing view's saved design and name have been loaded in
    loaded: false
  }
}

export function designerSessionKey (groupId, viewId) {
  return `${groupId}:${viewId}`
}

export function getDesignerSession (key) {
  if (!sessions.has(key)) sessions.set(key, emptySession())
  return sessions.get(key)
}

export function updateDesignerSession (key, patch) {
  const current = getDesignerSession(key)
  const changes = typeof patch === 'function' ? patch(current) : patch
  sessions.set(key, { ...current, ...changes })
  listeners.forEach(listener => listener())
}

export function resetDesignerSession (key) {
  sessions.delete(key)
  listeners.forEach(listener => listener())
}

function subscribe (listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDesignerSession (key) {
  return useSyncExternalStore(subscribe, () => getDesignerSession(key))
}

/**
 * Adds one turn's usage to a running total { count, tokens, costUsd, costKnown }.
 */
export function addDesignUsage (total, usage) {
  const known = usage?.estimatedCostUsd !== null && usage?.estimatedCostUsd !== undefined
  return {
    count: total.count + 1,
    tokens: total.tokens + (usage?.inputTokens || 0) + (usage?.outputTokens || 0),
    costUsd: total.costUsd + (known ? usage.estimatedCostUsd : 0),
    costKnown: total.costKnown && known
  }
}
