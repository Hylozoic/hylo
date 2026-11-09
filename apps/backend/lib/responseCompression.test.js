import http from 'http'
import zlib from 'zlib'
import responseCompression from './responseCompression'

const { preferredEncoding } = responseCompression

function fetchCompressed (acceptEncoding, body) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      responseCompression(req, res, () => {
        res.setHeader('Content-Type', 'application/json')
        res.end(body)
      })
    })
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      const req = http.get({
        port,
        headers: acceptEncoding ? { 'Accept-Encoding': acceptEncoding } : {}
      }, response => {
        const chunks = []
        response.on('data', chunk => chunks.push(chunk))
        response.on('end', () => {
          server.close()
          resolve({
            headers: response.headers,
            body: Buffer.concat(chunks)
          })
        })
      })
      req.on('error', err => {
        server.close()
        reject(err)
      })
    })
  })
}

describe('responseCompression', () => {
  const payload = JSON.stringify({ hello: 'world', pad: 'x'.repeat(4000) })

  it('prefers brotli when the client accepts it as strongly as gzip', () => {
    expect(preferredEncoding('gzip, deflate, br')).to.equal('br')
    expect(preferredEncoding('gzip;q=1, br;q=0.5')).to.equal('gzip')
    expect(preferredEncoding('br;q=0, gzip')).to.equal('gzip')
    expect(preferredEncoding(undefined)).to.equal(null)
  })

  it('brotli-compresses JSON when the client accepts br', async () => {
    const response = await fetchCompressed('br, gzip', payload)
    expect(response.headers['content-encoding']).to.equal('br')
    expect(response.headers.vary).to.equal('Accept-Encoding')
    expect(zlib.brotliDecompressSync(response.body).toString()).to.equal(payload)
  })

  it('gzip-compresses JSON when the client only accepts gzip', async () => {
    const response = await fetchCompressed('gzip', payload)
    expect(response.headers['content-encoding']).to.equal('gzip')
    expect(zlib.gunzipSync(response.body).toString()).to.equal(payload)
  })

  it('leaves small and unacceptable responses uncompressed', async () => {
    const small = await fetchCompressed('br, gzip', '{"ok":true}')
    expect(small.headers['content-encoding']).to.equal(undefined)
    expect(small.body.toString()).to.equal('{"ok":true}')

    const plain = await fetchCompressed(null, payload)
    expect(plain.headers['content-encoding']).to.equal(undefined)
    expect(plain.body.toString()).to.equal(payload)
  })
})
