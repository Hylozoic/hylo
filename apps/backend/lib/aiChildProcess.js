import { execFile } from 'child_process'
import path from 'path'

const MAX_OUTPUT_BYTES = 4 * 1024 * 1024

/**
 * Runs one of the lib/*Process.js entry points in a child Node process. This is
 * how the API runs the Hylo Pro AI features: neither the Anthropic SDK nor
 * Playwright can run inside the API process, because config/bootstrap.js
 * replaces the global Promise with Bluebird, and both subclass Promise, which
 * Bluebird refuses.
 *
 * The child gets only the environment variables named in envKeys, so nothing
 * of the API's secrets reaches it beyond the model key. It is given `args` on
 * the command line and, when `input` is set, that value as JSON on stdin. It
 * must print one line of JSON: { ok: true, result } or { ok: false, error }.
 *
 * Resolves with the result, or rejects with the child's error; `timeoutMessage`
 * is used when the child is killed for running too long, `startMessage` when it
 * produced nothing readable.
 */
export function runInChildProcess ({ script, args = [], input, envKeys, timeoutMs, timeoutMessage, startMessage }) {
  const env = Object.fromEntries(envKeys.filter(key => process.env[key]).map(key => [key, process.env[key]]))
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [path.join(__dirname, script), ...args],
      { env, cwd: path.join(__dirname, '..'), timeout: timeoutMs, maxBuffer: MAX_OUTPUT_BYTES },
      (error, stdout) => {
        let output = null
        try {
          output = JSON.parse(stdout)
        } catch (e) {}
        if (output?.ok) return resolve(output.result)
        if (output?.error) return reject(new Error(output.error))
        reject(new Error(error?.killed ? timeoutMessage : startMessage))
      }
    )
    if (input !== undefined) child.stdin.end(JSON.stringify(input))
  })
}
