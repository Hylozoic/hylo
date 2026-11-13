/**
 * Entry point of the child process that runs a theme import (see
 * importThemeInChildProcess in groupThemeImport.js for why it is a separate
 * process).
 *
 * Usage: node groupThemeImportProcess.js <url>
 * Prints { ok: true, result } or { ok: false, error } as one line of JSON.
 */
require('@babel/register')

const { importThemeFromUrl } = require('./groupThemeImport')

const finish = output => {
  process.stdout.write(JSON.stringify(output), () => process.exit(output.ok ? 0 : 1))
}

importThemeFromUrl(process.argv[2])
  .then(result => finish({ ok: true, result }))
  .catch(error => finish({ ok: false, error: String(error.message || error).split('\n')[0] }))
