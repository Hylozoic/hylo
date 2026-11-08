import http from 'http'
import nock from 'nock'
import { assertPublicUrl, isPrivateAddress, safeFetch, safeLookup } from '../../../lib/safeFetch'
import { createZapierTrigger } from '../../../api/graphql/mutations/zapier'
import factories from '../../setup/factories'
require('../../setup')

describe('safeFetch', () => {
  describe('isPrivateAddress', () => {
    it('flags loopback, private, link-local and mapped addresses', () => {
      ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0',
        '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:169.254.169.254'
      ].forEach(address => expect(isPrivateAddress(address), address).to.equal(true))
    })

    it('allows public addresses', () => {
      ['8.8.8.8', '151.101.1.69', '2606:4700::1111'].forEach(address =>
        expect(isPrivateAddress(address), address).to.equal(false))
    })
  })

  describe('assertPublicUrl', () => {
    it('refuses non-http protocols and private IP literals, in any notation', () => {
      ['file:///etc/passwd', 'ftp://example.com/x', 'gopher://example.com', 'http://127.0.0.1/', 'http://[::1]/',
        'http://2130706433/', 'http://0x7f.1/', 'http://169.254.169.254/latest/meta-data/', 'not a url'
      ].forEach(url => expect(() => assertPublicUrl(url), url).to.throw())
    })

    it('allows public http and https URLs', () => {
      expect(assertPublicUrl('https://hooks.zapier.com/hooks/catch/1/abc').hostname).to.equal('hooks.zapier.com')
      expect(assertPublicUrl('http://8.8.8.8/').hostname).to.equal('8.8.8.8')
    })
  })

  describe('safeLookup', () => {
    it('fails for a hostname that resolves to a private address', done => {
      safeLookup('localhost', {}, err => {
        expect(err.code).to.equal('EPRIVATEADDRESS')
        done()
      })
    })
  })

  describe('requests', () => {
    let server, port

    before(done => {
      server = http.createServer((req, res) => res.end('internal secret')).listen(0, '127.0.0.1', () => {
        port = server.address().port
        done()
      })
    })

    after(done => {
      nock.cleanAll()
      server.close(done)
    })

    it('does not connect to a hostname that resolves to a private address', async () => {
      await expect(safeFetch(`http://localhost:${port}/`)).to.be.rejectedWith(/private address/)
    })

    it('does not follow a redirect to a private address', async () => {
      nock('https://public.example').get('/start').reply(302, '', { Location: 'http://169.254.169.254/latest/meta-data/' })
      await expect(safeFetch('https://public.example/start')).to.be.rejectedWith(/private address/)
    })

    it('does not follow a redirect to a hostname that resolves privately', async () => {
      nock('https://public.example').get('/sneaky').reply(301, '', { Location: `http://localhost:${port}/` })
      await expect(safeFetch('https://public.example/sneaky')).to.be.rejectedWith(/private address/)
    })

    it('follows public redirects and returns the final response', async () => {
      nock('https://public.example').get('/old').reply(301, '', { Location: '/new' })
      nock('https://public.example').get('/new').reply(200, 'hello')
      const response = await safeFetch('https://public.example/old')
      expect(response.status).to.equal(200)
      expect(await response.text()).to.equal('hello')
    })
  })

  describe('createZapierTrigger', () => {
    it('refuses a private target URL', async () => {
      const user = await factories.user().save()
      await expect(createZapierTrigger(user.id, [], 'http://169.254.169.254/', 'new_post', {})).to.be.rejectedWith(/private address/)
    })
  })
})
