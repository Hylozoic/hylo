// Process-lifecycle tests for scripts/run-isolated-e2e.js: however the runner exits, the backend
// and Playwright it started must not survive. Uses a fake backend and fake Playwright and skips the DB steps.
import { spawn } from 'child_process'
import net from 'net'
import os from 'os'
import path from 'path'

const scriptsDir = path.resolve(__dirname, '..')
const runnerPath = path.join(scriptsDir, 'run-isolated-e2e.js')
const fakeBackend = path.join(__dirname, 'fixtures', 'fake-backend.cjs')
const fakePlaywright = path.join(__dirname, 'fixtures', 'fake-playwright.cjs')

jest.setTimeout(30000)

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const isAlive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

const waitFor = async (check, timeoutMs) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (check()) return true
    await sleep(100)
  }
  return check()
}

const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address()
    server.close(() => resolve(port))
  })
})

/** Processes started (directly or via the runner) by the current test, killed if still alive afterwards. */
let started = []

afterEach(() => {
  const leftovers = started.filter(isAlive)
  leftovers.forEach(pid => process.kill(pid, 'SIGKILL'))
  started = []
  if (leftovers.length) throw new Error(`Test left processes running (now killed): ${leftovers.join(', ')}`)
})

/**
 * Starts the runner and resolves once the fake Playwright is running, with the pids involved.
 */
async function startRunner (extraEnv = {}) {
  const env = {
    ...process.env,
    E2E_DATABASE_URL: 'postgres://postgres@127.0.0.1:5432/hylo_e2e_lifecycle_test',
    E2E_DB_NAME: '',
    E2E_BACKEND_PORT: String(await freePort()),
    E2E_SEED_PROFILE: 'none',
    E2E_RUNNER_SKIP_DB: '1',
    E2E_RUNNER_BACKEND_SCRIPT: fakeBackend,
    E2E_RUNNER_PLAYWRIGHT_SCRIPT: fakePlaywright,
    ...extraEnv
  }
  delete env.E2E_DB_NAME

  const runner = spawn('node', [runnerPath], { cwd: path.resolve(scriptsDir, '..'), env, stdio: ['ignore', 'pipe', 'pipe'] })
  started.push(runner.pid)

  let output = ''
  const exited = new Promise(resolve => {
    runner.on('exit', (code, signal) => resolve({ code, signal }))
  })
  const ready = new Promise((resolve, reject) => {
    const onData = (chunk) => {
      output += chunk
      const backendMatch = output.match(/Backend pid (\d+)/)
      if (backendMatch && !started.includes(Number(backendMatch[1]))) started.push(Number(backendMatch[1]))
      const playwrightMatch = output.match(/FAKE_PLAYWRIGHT_STARTED pid=(\d+)/)
      if (playwrightMatch && !started.includes(Number(playwrightMatch[1]))) started.push(Number(playwrightMatch[1]))
      if (backendMatch && playwrightMatch) {
        resolve({ backendPid: Number(backendMatch[1]), playwrightPid: Number(playwrightMatch[1]) })
      }
    }
    runner.stdout.on('data', onData)
    runner.stderr.on('data', onData)
    exited.then(() => reject(new Error(`Runner exited before Playwright started:\n${output}`)))
  })

  const pids = await ready
  return { runner, exited, output: () => output, ...pids }
}

describe('run-isolated-e2e.js process lifecycle', () => {
  it('stops the backend after Playwright passes', async () => {
    const { exited, backendPid, output } = await startRunner({ FAKE_PLAYWRIGHT_EXIT_CODE: '0' })
    expect((await exited).code).toBe(0)
    expect(output()).toContain(`Stopping backend (pid ${backendPid})`)
    expect(isAlive(backendPid)).toBe(false)
  })

  it('stops the backend and keeps the exit code when Playwright fails', async () => {
    const { exited, backendPid } = await startRunner({ FAKE_PLAYWRIGHT_EXIT_CODE: '3' })
    expect((await exited).code).toBe(3)
    expect(isAlive(backendPid)).toBe(false)
  })

  it.each(['SIGINT', 'SIGTERM', 'SIGHUP'])('tears down when the runner gets %s during Playwright', async (signal) => {
    const { runner, exited, backendPid, playwrightPid, output } = await startRunner()
    expect(isAlive(backendPid)).toBe(true)

    runner.kill(signal)
    expect((await exited).code).toBe(128 + os.constants.signals[signal])
    expect(output()).toContain(`Received ${signal}; tearing down`)
    expect(output()).toContain(`Stopping backend (pid ${backendPid})`)
    expect(output()).toContain('Skipping DB drop')
    expect(isAlive(backendPid)).toBe(false)
    expect(await waitFor(() => !isAlive(playwrightPid), 2000)).toBe(true)
  })

  it('does not leave the backend or Playwright running when the runner is SIGKILLed', async () => {
    const { runner, exited, backendPid, playwrightPid } = await startRunner()
    expect(isAlive(backendPid)).toBe(true)

    runner.kill('SIGKILL')
    expect((await exited).signal).toBe('SIGKILL')
    // The watchdog polls every 500ms; allow a few seconds.
    expect(await waitFor(() => !isAlive(backendPid), 5000)).toBe(true)
    expect(await waitFor(() => !isAlive(playwrightPid), 5000)).toBe(true)
  })
})
