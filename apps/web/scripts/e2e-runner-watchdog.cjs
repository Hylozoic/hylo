/**
 * Preloaded (`node -r`) into the backend and Playwright that scripts/run-isolated-e2e.js starts —
 * never into a normal dev/prod backend. It makes them exit when the runner is gone, so they cannot
 * be orphaned even if the runner is SIGKILLed (on macOS a child is not killed when its parent dies).
 * E2E_WATCHDOG_SIGNAL picks the signal: the runner sets SIGINT for Playwright, which (unlike on
 * SIGTERM) then stops its own Vite web server.
 *
 * The runner passes its pid as E2E_RUNNER_PID. We only watch when that runner is our direct
 * parent at startup, so processes that merely inherit the env/execArgv (e.g. cluster workers)
 * are left alone.
 */
const runnerPid = Number(process.env.E2E_RUNNER_PID)
const POLL_MS = 500
const FORCE_EXIT_MS = 10000
const signal = process.env.E2E_WATCHDOG_SIGNAL || 'SIGTERM'

if (runnerPid > 0 && process.ppid === runnerPid) {
  const timer = setInterval(() => {
    // An orphan is re-parented (to launchd/init), so ppid changes once the runner dies.
    if (process.ppid === runnerPid) return
    clearInterval(timer)
    console.error(`[isolated-e2e] Runner (pid ${runnerPid}) is gone; stopping ${process.pid}`)
    setTimeout(() => process.exit(1), FORCE_EXIT_MS)
    process.kill(process.pid, signal)
  }, POLL_MS)
  timer.unref()
}
