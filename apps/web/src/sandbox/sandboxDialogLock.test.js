import { claimSandboxDialog, onSandboxDialogReleased, releaseSandboxDialog } from './sandboxDialogLock'

describe('sandboxDialogLock', () => {
  afterEach(() => {
    releaseSandboxDialog('a')
    releaseSandboxDialog('b')
  })

  it('lets only one dialog hold the lock at a time', () => {
    expect(claimSandboxDialog('a')).toBe(true)
    expect(claimSandboxDialog('b')).toBe(false)
    expect(claimSandboxDialog('a')).toBe(true)
  })

  it('ignores releases from a dialog that does not hold the lock', () => {
    claimSandboxDialog('a')
    releaseSandboxDialog('b')
    expect(claimSandboxDialog('b')).toBe(false)
  })

  it('notifies waiters on release until they unsubscribe', () => {
    const waiter = jest.fn()
    const unsubscribe = onSandboxDialogReleased(waiter)
    claimSandboxDialog('a')
    releaseSandboxDialog('a')
    expect(waiter).toHaveBeenCalledTimes(1)
    expect(claimSandboxDialog('b')).toBe(true)

    unsubscribe()
    releaseSandboxDialog('b')
    expect(waiter).toHaveBeenCalledTimes(1)
  })
})
