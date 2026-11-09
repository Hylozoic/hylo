import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Shapes } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from 'components/ui/dialog'
import { isSandboxMode } from 'sandbox/isSandbox'
import { claimSandboxDialog, onSandboxDialogReleased, releaseSandboxDialog } from 'sandbox/sandboxDialogLock'

/**
 * Timed sign-up prompt for the demo.
 *
 * After SANDBOX_TIMED_MODAL_MS ms of *active* demo use, show a dialog nudging
 * the visitor to create a real account. "Active" is tracked with the Page
 * Visibility API so the timer pauses when the tab is hidden and resumes with
 * the remaining time when it is visible again. The prompt is remembered in
 * sessionStorage for the current demo session, so it doesn't nag again on
 * every reload.
 *
 * If another sandbox prompt is open when the time is up, wait until it closes
 * (plus a short pause) rather than stacking dialogs.
 */
const SANDBOX_TIMED_MODAL_MS = 100 * 1000
const RETRY_AFTER_OTHER_DIALOG_MS = 3 * 1000
const DIALOG_NAME = 'timed'
const SESSION_KEY = 'hylo-sandbox-timed-modal-dismissed'

export default function SandboxTimedModal () {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!isSandboxMode()) return
    try {
      if (window.sessionStorage?.getItem(SESSION_KEY) === '1') return
    } catch (e) { /* storage unavailable */ }

    let timer = null
    let remaining = SANDBOX_TIMED_MODAL_MS
    let startedAt = 0
    let stopWaiting = null

    const show = () => {
      timer = null
      if (!claimSandboxDialog(DIALOG_NAME)) {
        // Resume the (paused-when-hidden) countdown with a short grace period
        // once the other dialog closes.
        stopWaiting = onSandboxDialogReleased(() => {
          stopWaiting()
          stopWaiting = null
          remaining = RETRY_AFTER_OTHER_DIALOG_MS
          if (!document.hidden) startTimer()
        })
        return
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      try {
        window.sessionStorage?.setItem(SESSION_KEY, '1')
      } catch (e) { /* storage unavailable */ }
      setOpen(true)
    }
    const startTimer = () => {
      if (timer || stopWaiting) return
      startedAt = Date.now()
      timer = setTimeout(show, remaining)
    }
    const pauseTimer = () => {
      if (!timer) return
      clearTimeout(timer)
      timer = null
      remaining = Math.max(0, remaining - (Date.now() - startedAt))
    }
    function handleVisibilityChange () {
      if (document.hidden) pauseTimer()
      else startTimer()
    }

    // Only count time while the visitor is actually looking at the demo.
    if (!document.hidden) startTimer()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimeout(timer)
      stopWaiting?.()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      releaseSandboxDialog(DIALOG_NAME)
    }
  }, [])

  const handleOpenChange = (isOpen) => {
    setOpen(isOpen)
    if (!isOpen) releaseSandboxDialog(DIALOG_NAME)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent overlayClassName='bg-darkening/30'>
        <DialogHeader className='items-center text-center sm:text-center'>
          <Shapes className='mb-2 h-8 w-8' aria-hidden='true' />
          <DialogTitle>{t('Enjoying the demo?')}</DialogTitle>
          <DialogDescription>
            {t('Create a free account to keep exploring with real communities — your posts, comments, and messages will actually be saved and shared.')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type='button'
            onClick={() => handleOpenChange(false)}
            className='px-4 py-2 rounded-md border border-foreground/20 hover:bg-foreground/5 transition-colors'
          >
            {t('Maybe later')}
          </button>
          <a
            href='/signup'
            className='px-4 py-2 rounded-md bg-foreground text-background font-semibold text-center hover:opacity-90 transition-opacity'
          >
            {t('Create free account')}
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
