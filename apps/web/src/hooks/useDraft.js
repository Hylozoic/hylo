import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { deleteDraft, fetchDraft, removeDraftByContext, saveDraft as saveDraftAction } from 'store/actions/draftActions'
import { selectDraftForContext } from 'store/selectors/getDrafts'

export const stripHtml = html =>
  (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const hasDraftContent = html => stripHtml(html).length > 0

/** Post draft object or JSON string: true when trimmed title or HTML details has visible text */
export function hasPostDraftPayloadContent (data) {
  if (data == null) return false
  let obj = data
  if (typeof data === 'string') {
    try {
      obj = JSON.parse(data)
    } catch {
      return false
    }
  }
  if (!obj || typeof obj !== 'object') return false
  if (hasDraftContent(obj.details || '')) return true
  if ((obj.title || '').trim().length > 0) return true
  return false
}

/** Message draft JSON string `{ text }` from Messages composer */
export function hasMessageDraftPayloadContent (serialised) {
  if (serialised == null || serialised === '') return false
  if (typeof serialised !== 'string') return false
  try {
    const obj = JSON.parse(serialised)
    if (obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, 'text')) {
      return String(obj.text ?? '').trim().length > 0
    }
  } catch {
    // fall through
  }
  return hasDraftContent(serialised)
}

function shouldPersistDraftPayload (type, serialised) {
  if (!serialised) return false
  if (type === 'post') return hasPostDraftPayloadContent(serialised)
  if (type === 'comment') return hasDraftContent(serialised)
  if (type === 'message') return hasMessageDraftPayloadContent(serialised)
  return false
}

/**
 * Stable key for deduping saves. Strips `savedAt` from JSON post drafts so idle
 * re-renders do not produce a new payload every tick.
 */
function draftDedupeKey (data) {
  if (data == null) return null
  const str = typeof data === 'string' ? data : JSON.stringify(data)
  try {
    const obj = JSON.parse(str)
    if (obj && typeof obj === 'object' && !Array.isArray(obj) && Object.prototype.hasOwnProperty.call(obj, 'savedAt')) {
      const rest = { ...obj }
      delete rest.savedAt
      return JSON.stringify(rest)
    }
  } catch {
    // Opaque string (e.g. comment HTML)
  }
  return str
}

/**
 * Provides draft persistence for a single composing surface.
 *
 * Context must include at minimum `type` ('post' | 'comment' | 'message') and
 * the relevant FK identifiers. Call `saveDraft(data)` to persist; call
 * `clearDraft()` on successful submit.
 */
export default function useDraft ({
  type,
  postId,
  groupId,
  topicId,
  messageThreadId,
  postType,
  isEdit = false,
  navigateTo,
  debounceMs = 1000,
  // Optional: only load if the user is authenticated (skip for anon)
  skip = false
}) {
  const dispatch = useDispatch()
  const context = useMemo(() => ({ type, postId, groupId, topicId, messageThreadId, postType, isEdit }), [type, postId, groupId, topicId, messageThreadId, postType, isEdit])
  const draft = useSelector(state => selectDraftForContext(state, context))

  const loadedData = draft?.data || null
  const [isLoaded, setIsLoaded] = useState(false)

  const saveTimerRef = useRef(null)
  const pendingSaveRef = useRef(null)
  const isSavingRef = useRef(false)
  const lastSavedDedupeKeyRef = useRef(null)
  const activeDraftIdRef = useRef(null)

  // Stable context reference to avoid stale closures
  const contextRef = useRef({ type, postId, groupId, topicId, messageThreadId, postType, isEdit, navigateTo })
  useEffect(() => {
    contextRef.current = { type, postId, groupId, topicId, messageThreadId, postType, isEdit, navigateTo }
  }, [type, postId, groupId, topicId, messageThreadId, postType, isEdit, navigateTo])

  useEffect(() => {
    lastSavedDedupeKeyRef.current = draftDedupeKey(loadedData)
  }, [loadedData])

  useEffect(() => {
    activeDraftIdRef.current = draft?.id || null
  }, [draft?.id])

  // Load draft from server on mount / when context changes
  useEffect(() => {
    if (skip || !type) {
      setIsLoaded(true)
      return
    }

    let cancelled = false
    setIsLoaded(false)

    const load = async () => {
      try {
        const result = await dispatch(fetchDraft({ type, postId, groupId, topicId, messageThreadId, postType, isEdit }))
        if (cancelled) return
        const serverDraft = result?.payload?.data?.draft
        if (serverDraft == null) {
          dispatch(removeDraftByContext({ type, postId, groupId, topicId, messageThreadId, postType, isEdit }))
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[useDraft] fetch draft failed:', err)
        }
      } finally {
        if (!cancelled) setIsLoaded(true)
      }
    }

    load()
    return () => { cancelled = true }
  }, [dispatch, type, postId, groupId, topicId, messageThreadId, postType, isEdit, skip, navigateTo])

  /** Debounced save - call on every content change. */
  const saveDraft = useCallback((data) => {
    if (skip || !type) return

    // Serialise if needed
    const serialised = typeof data === 'string' ? data : JSON.stringify(data)
    pendingSaveRef.current = serialised

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(async () => {
      if (isSavingRef.current) return // skip overlapping saves
      const payload = pendingSaveRef.current
      const dedupeKey = draftDedupeKey(payload)
      if (!payload || dedupeKey === lastSavedDedupeKeyRef.current) return
      const ctxForPayload = contextRef.current
      if (!shouldPersistDraftPayload(ctxForPayload.type, payload)) return
      isSavingRef.current = true

      try {
        const ctx = contextRef.current
        const variables = {
          type: ctx.type,
          data: payload,
          postId: ctx.postId,
          groupId: ctx.groupId,
          topicId: ctx.topicId,
          messageThreadId: ctx.messageThreadId,
          postType: ctx.postType,
          isEdit: ctx.isEdit,
          navigateTo: ctx.navigateTo
        }
        const result = await dispatch(saveDraftAction(variables))
        const draft = result?.payload?.data?.saveDraft
        if (draft?.id) {
          activeDraftIdRef.current = draft.id
        }
        if (draft?.id || draft?.data != null) {
          lastSavedDedupeKeyRef.current = dedupeKey
          window.dispatchEvent(new Event('hylo:drafts-changed'))
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[useDraft] save draft failed:', err)
        }
      } finally {
        isSavingRef.current = false
      }
    }, debounceMs)
  }, [dispatch, skip, type, debounceMs])

  /**
   * Saves immediately (clears any pending debounced save). Pass latest payload string,
   * or omit to flush whatever was last passed to saveDraft.
   * @param {string|object|undefined|null} overrideData Latest payload, or omit to use pending buffer
   * @param {{ force?: boolean }} [options] Pass `{ force: true }` so an explicit leave-save always hits the server (skips dedupe).
   */
  const flushSaveDraft = useCallback(async (overrideData, options = {}) => {
    if (skip || !type) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const serialised = overrideData !== undefined && overrideData !== null
      ? (typeof overrideData === 'string' ? overrideData : JSON.stringify(overrideData))
      : pendingSaveRef.current

    if (!serialised) return
    const dedupeKey = draftDedupeKey(serialised)
    if (!options.force && dedupeKey === lastSavedDedupeKeyRef.current) return

    const ctxBeforeSave = contextRef.current
    if (!shouldPersistDraftPayload(ctxBeforeSave.type, serialised)) return

    pendingSaveRef.current = serialised
    const ctx = contextRef.current
    isSavingRef.current = true

    try {
      const result = await dispatch(saveDraftAction({
        type: ctx.type,
        data: serialised,
        postId: ctx.postId,
        groupId: ctx.groupId,
        topicId: ctx.topicId,
        messageThreadId: ctx.messageThreadId,
        postType: ctx.postType,
        isEdit: ctx.isEdit,
        navigateTo: ctx.navigateTo
      }))
      const saved = result?.payload?.data?.saveDraft
      if (saved?.id) {
        activeDraftIdRef.current = saved.id
      }
      if (saved?.id || saved?.data != null) {
        lastSavedDedupeKeyRef.current = dedupeKey
        window.dispatchEvent(new Event('hylo:drafts-changed'))
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[useDraft] flush save failed:', err)
      }
    } finally {
      isSavingRef.current = false
    }
  }, [dispatch, skip, type])

  /**
   * Call on successful submit to clear local draft state and optionally delete on server.
   * Some submit mutations already delete their own drafts on the backend.
   */
  const clearDraft = useCallback(async ({ deleteOnServer = true } = {}) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    pendingSaveRef.current = null
    dispatch(removeDraftByContext(contextRef.current))

    if (!deleteOnServer) {
      activeDraftIdRef.current = null
      lastSavedDedupeKeyRef.current = null
      window.dispatchEvent(new Event('hylo:drafts-changed'))
      return
    }

    const id = draft?.id || activeDraftIdRef.current

    if (!id) return

    try {
      await dispatch(deleteDraft(id))
      activeDraftIdRef.current = null
      lastSavedDedupeKeyRef.current = null
      window.dispatchEvent(new Event('hylo:drafts-changed'))
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[useDraft] delete draft failed:', err)
      }
    }
  }, [dispatch, draft?.id])

  return {
    /** Raw draft data string from server (JSON or HTML depending on type). Null until loaded. */
    loadedData,
    /** True once the initial server load attempt has completed (success or failure). */
    isLoaded,
    saveDraft,
    flushSaveDraft,
    clearDraft
  }
}
