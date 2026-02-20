import { useCallback, useMemo } from 'react'

const STORAGE_PREFIX = 'draft:'

export const stripHtml = html =>
  (html || '')
    .replace(/<[^>]*>/g, ' ') // remove tags
    .replace(/&nbsp;/g, ' ') // decode common nbsp
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim()

export const hasDraftContent = html => stripHtml(html).length > 0

export default function useDraftStorage (key) {
  const storageKey = useMemo(() => {
    if (!key) return null
    return key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`
  }, [key])

  const loadDraft = useCallback(() => {
    if (typeof window === 'undefined' || !storageKey) return ''
    try {
      return window.localStorage.getItem(storageKey) || ''
    } catch (err) {
      return ''
    }
  }, [storageKey])

  const dispatchDraftChange = useCallback(() => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event('hylo:drafts-changed'))
  }, [])

  const saveDraft = useCallback((html) => {
    if (typeof window === 'undefined' || !storageKey) return
    if (!hasDraftContent(html)) {
      try {
        window.localStorage.removeItem(storageKey)
      } catch (err) {}
      dispatchDraftChange()
      return
    }
    try {
      window.localStorage.setItem(storageKey, html)
    } catch (err) {}
    dispatchDraftChange()
  }, [dispatchDraftChange, storageKey])

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined' || !storageKey) return
    try {
      window.localStorage.removeItem(storageKey)
    } catch (err) {}
    dispatchDraftChange()
  }, [dispatchDraftChange, storageKey])

  const loadDraftJSON = useCallback(() => {
    const raw = loadDraft()
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch (err) {
      return null
    }
  }, [loadDraft])

  const saveDraftJSON = useCallback((value) => {
    if (typeof window === 'undefined' || !storageKey) return
    if (!value) {
      clearDraft()
      return
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value))
    } catch (err) {}
    dispatchDraftChange()
  }, [clearDraft, dispatchDraftChange, storageKey])

  return {
    loadDraft,
    saveDraft,
    clearDraft,
    loadDraftJSON,
    saveDraftJSON
  }
}
