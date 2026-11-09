// Stand-in for Playwright in run-isolated-e2e.test.js: reports it started, then either exits with
// FAKE_PLAYWRIGHT_EXIT_CODE or keeps "running tests" until it is signalled.
console.log(`FAKE_PLAYWRIGHT_STARTED pid=${process.pid}`)

if (process.env.FAKE_PLAYWRIGHT_EXIT_CODE) {
  setTimeout(() => process.exit(Number(process.env.FAKE_PLAYWRIGHT_EXIT_CODE)), 200)
} else {
  setInterval(() => {}, 1000)
  // Leak guard only, in case the test process itself dies.
  setTimeout(() => process.exit(0), 60000)
}
