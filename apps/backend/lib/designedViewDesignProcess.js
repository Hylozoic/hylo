/**
 * Entry point of the child process that runs one turn of the "Design your own
 * view" chat (see designViewTurnInChildProcess in designedViewDesign.js for why
 * it is a separate process).
 *
 * Reads the request as JSON on stdin.
 * Prints { ok: true, result } or { ok: false, error } as one line of JSON.
 */
require('@babel/register')

const { designViewTurn } = require('./designedViewDesign')

const finish = output => {
  process.stdout.write(JSON.stringify(output), () => process.exit(output.ok ? 0 : 1))
}

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  Promise.resolve()
    .then(() => designViewTurn(JSON.parse(input)))
    .then(result => finish({ ok: true, result }))
    .catch(error => finish({ ok: false, error: String(error.message || error).split('\n')[0] }))
})
