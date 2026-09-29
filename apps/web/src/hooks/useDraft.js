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
  if ((obj.meetingLink || '').trim().length > 0) return true
  if ((obj.location || '').trim().length > 0) return true
  if ((obj.donationsLink || '').trim().length > 0) return true
  if ((obj.projectManagementLink || '').trim().length > 0) return true
  if (obj.startTime || obj.endTime) return true
  if (obj.imageUrls?.length > 0 || obj.fileUrls?.length > 0) return true
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

const DRAFT_CONTEXT_KEYS = ['type', 'postId', 'groupId', 'topicId', 'messageThreadId', 'postType', 'isEdit']

const sameDraftContext = (a, b) => DRAFT_CONTEXT_KEYS.every(key => a?.[key] === b?.[key])

const draftContextKey = context => DRAFT_CONTEXT_KEYS
  .map(key => key === 'isEdit' ? String(!!context?.[key]) : String(context?.[key] ?? ''))
  .join('|')

/**
 * Drafts that could not reach the server (for example a post that failed to
 * send while offline), kept in memory for the next composer opened in the same
 * context. They are newer than any copy the server has, so that composer
 * starts from them. A later successful save in that context lets them go.
 */
const unsentDrafts = new Map()

/**
 * Saves `data` as the draft for `context` unless the server already holds one
 * there. For content whose composer has since moved on to another context.
 */
export async function keepAsDraftUnlessPresent (dispatch, context, data) {
  const { type, postId, groupId, topicId, messageThreadId, postType, isEdit = false, navigateTo } = context
  try {
    const existing = await dispatch(fetchDraft({ type, postId, groupId, topicId, messageThreadId, postType, isEdit }))
    if (existing?.payload?.data?.draft) return
    await dispatch(saveDraftAction({ type, data, postId, groupId, topicId, messageThreadId, postType, isEdit, navigateTo }))
    window.dispatchEvent(new Event('hylo:drafts-changed'))
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[useDraft] keeping draft failed:', err)
    }
  }
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

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    // Empty / non-persistable payload: drop any pending debounced save so a
    // previous timer cannot fire after the user clears the composer (e.g.
    // message draft after deleting to one character then clearing).
    // The context is the one the content was written in: the composer may
    // have moved on (another chat room or post) before the timer fires.
    const ctx = contextRef.current
    if (!shouldPersistDraftPayload(ctx.type, serialised)) {
      pendingSaveRef.current = null
      return
    }

    pendingSaveRef.current = serialised

    saveTimerRef.current = setTimeout(async () => {
      if (isSavingRef.current) return // skip overlapping saves
      const payload = pendingSaveRef.current
      const dedupeKey = draftDedupeKey(payload)
      if (!payload || dedupeKey === lastSavedDedupeKeyRef.current) return
      if (!shouldPersistDraftPayload(ctx.type, payload)) return
      isSavingRef.current = true

      try {
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
        const stillInContext = sameDraftContext(ctx, contextRef.current)
        if (draft?.id && stillInContext) {
          activeDraftIdRef.current = draft.id
        }
        if (draft?.id || draft?.data != null) {
          if (stillInContext) lastSavedDedupeKeyRef.current = dedupeKey
          unsentDrafts.delete(draftContextKey(ctx))
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
   * @returns {Promise<boolean>} true when the server holds this draft afterwards
   */
  const flushSaveDraft = useCallback(async (overrideData, options = {}) => {
    if (skip || !type) return false

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const serialised = overrideData !== undefined && overrideData !== null
      ? (typeof overrideData === 'string' ? overrideData : JSON.stringify(overrideData))
      : pendingSaveRef.current

    if (!serialised) return false
    const dedupeKey = draftDedupeKey(serialised)
    if (!options.force && dedupeKey === lastSavedDedupeKeyRef.current) return true

    const ctxBeforeSave = contextRef.current
    if (!shouldPersistDraftPayload(ctxBeforeSave.type, serialised)) return false

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
        unsentDrafts.delete(draftContextKey(ctx))
        window.dispatchEvent(new Event('hylo:drafts-changed'))
        return true
      }
      return false
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[useDraft] flush save failed:', err)
      }
      return false
    } finally {
      isSavingRef.current = false
    }
  }, [dispatch, skip, type])

  /**
   * Keeps a draft that could not be saved to the server in memory, so the next
   * composer opened in this context starts from it (see takeUnsentDraft).
   */
  const holdUnsentDraft = useCallback((data) => {
    if (skip || !type || data == null) return
    unsentDrafts.set(draftContextKey(contextRef.current), typeof data === 'string' ? data : JSON.stringify(data))
  }, [skip, type])

  /** Returns, and forgets, a draft held for this context by holdUnsentDraft; null when there is none. */
  const takeUnsentDraft = useCallback(() => {
    const key = draftContextKey(context)
    const data = unsentDrafts.get(key) ?? null
    unsentDrafts.delete(key)
    return data
  }, [context])

  /**
   * Cancels any pending debounced save without touching Redux or the server.
   * Call this at the start of a submit to ensure no in-flight save fires during
   * the async mutation (e.g. createPost taking >1 s).
   */
  const cancelPendingSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    pendingSaveRef.current = null
  }, [])

  /**
   * Call on successful submit to clear local draft state and optionally delete on server.
   * Some submit mutations already delete their own drafts on the backend.
   *
   * Uses activeDraftIdRef (kept in sync via useEffect) instead of the selector-based
   * draft?.id so that this callback is stable and does not cause dependent effects to
   * re-run when the draft is removed from the Redux store.
   */
  const clearDraft = useCallback(async ({ deleteOnServer = true } = {}) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    pendingSaveRef.current = null
    unsentDrafts.delete(draftContextKey(contextRef.current))

    // Use the ref — it is always current and does not make this callback unstable.
    const idToDelete = deleteOnServer ? activeDraftIdRef.current : null

    dispatch(removeDraftByContext(contextRef.current))

    if (!deleteOnServer || !idToDelete) {
      activeDraftIdRef.current = null
      lastSavedDedupeKeyRef.current = null
      window.dispatchEvent(new Event('hylo:drafts-changed'))
      return
    }

    try {
      await dispatch(deleteDraft(idToDelete))
      activeDraftIdRef.current = null
      lastSavedDedupeKeyRef.current = null
      window.dispatchEvent(new Event('hylo:drafts-changed'))
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[useDraft] delete draft failed:', err)
      }
    }
  }, [dispatch])

  return {
    /** Raw draft data string from server (JSON or HTML depending on type). Null until loaded. */
    loadedData,
    /** True once the initial server load attempt has completed (success or failure). */
    isLoaded,
    saveDraft,
    flushSaveDraft,
    cancelPendingSave,
    clearDraft,
    holdUnsentDraft,
    takeUnsentDraft
  }
}
