// Stand-in for `node app.js` in run-isolated-e2e.test.js: answers HTTP on PORT like the API.
const http = require('http')

// Lets the test check the env the runner gives its backend (#1722: it must not be able to send email)
console.log(`FAKE_BACKEND_EMAIL_ENV ${JSON.stringify({
  SENDWITHUS_KEY: process.env.SENDWITHUS_KEY,
  DISABLE_EMAIL_SENDING: process.env.DISABLE_EMAIL_SENDING
})}`)

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end('{}')
}).listen(Number(process.env.PORT))

// Leak guard only (far longer than the test's few-second assertions).
setTimeout(() => process.exit(0), 60000).unref()
