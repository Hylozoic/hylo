/**
 * Entry point of the child process that runs one AI turn of "Design your own
 * view" (see designViewTurnInChildProcess in designedViewDesign.js for why it is
 * a separate process).
 *
 * Reads the request as JSON on stdin; request.kind is 'design' or 'suggest'.
 * Prints { ok: true, result } or { ok: false, error } as one line of JSON.
 */
require('@babel/register')

const { designViewTurn, suggestViewsTurn } = require('./designedViewDesign')

const finish = output => {
  process.stdout.write(JSON.stringify(output), () => process.exit(output.ok ? 0 : 1))
}

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  Promise.resolve()
    .then(() => {
      const { kind, ...request } = JSON.parse(input)
      return kind === 'suggest' ? suggestViewsTurn(request) : designViewTurn(request)
    })
    .then(result => finish({ ok: true, result }))
    .catch(error => finish({ ok: false, error: String(error.message || error).split('\n')[0] }))
})
