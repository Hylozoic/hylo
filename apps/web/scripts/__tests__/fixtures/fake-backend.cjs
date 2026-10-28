// Stand-in for `node app.js` in run-isolated-e2e.test.js: answers HTTP on PORT like the API.
const http = require('http')

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end('{}')
}).listen(Number(process.env.PORT))

// Leak guard only (far longer than the test's few-second assertions).
setTimeout(() => process.exit(0), 60000).unref()
