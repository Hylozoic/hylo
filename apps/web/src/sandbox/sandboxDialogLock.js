/**
 * Ensures only one sandbox prompt (SandboxNoticeModal, SandboxTimedModal, …)
 * is open at a time. A dialog claims the lock before opening and releases it
 * when it closes; dialogs that lose the race can wait for the lock to free up.
 */
let activeDialog = null
const waiters = new Set()

/** Claim the lock for `name`. Returns false if another dialog is open. */
export function claimSandboxDialog (name) {
  if (activeDialog && activeDialog !== name) return false
  activeDialog = name
  return true
}

/** Release the lock held by `name` and notify anyone waiting for it. */
export function releaseSandboxDialog (name) {
  if (activeDialog !== name) return
  activeDialog = null
  waiters.forEach(callback => callback())
}

/** Call `callback` each time the lock is released. Returns an unsubscribe function. */
export function onSandboxDialogReleased (callback) {
  waiters.add(callback)
  return () => waiters.delete(callback)
}
