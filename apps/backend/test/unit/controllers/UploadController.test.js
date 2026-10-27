/* globals UploadController */

var root = require('root-path')
var nock = require('nock')
require(root('test/setup'))
var factories = require(root('test/setup/factories'))

describe('UploadController', () => {
  var req, res

  beforeEach(() => {
    req = factories.mock.request()
    res = factories.mock.response()
  })

  describe('uploading via x-www-form-urlencoded', () => {
    beforeEach(() => {
      req.headers['content-type'] = 'application/x-www-form-urlencoded'
    })

    it('returns an error if the request has no url', () => {
      req.body = 'type=userAvatar'
      return UploadController.create(req, res)
      .then(() => {
        expect(res.body.error).to.equal('Validation error: No url and no stream')
      })
    })

    it('returns an error if the request has a bad type', () => {
      req.body = 'url=http://foo.com/foo.png'
      return UploadController.create(req, res)
      .then(() => {
        expect(res.body.error).to.equal('Validation error: Invalid type')
      })
    })
  })

  describe('uploading via json', () => {
    beforeEach(() => {
      req.headers['content-type'] = 'application/json'
    })

    it('returns an error if the request has no url', () => {
      req.params.type = 'userAvatar'
      return UploadController.create(req, res)
      .then(() => {
        expect(res.body.error).to.equal('Validation error: No url and no stream')
      })
    })

    it('returns an error if the request has a bad type', () => {
      req.params.url = 'http://foo.com/foo.png'
      return UploadController.create(req, res)
      .then(() => {
        expect(res.body.error).to.equal('Validation error: Invalid type')
      })
    })
  })

  describe('uploading via file', () => {
    let s3Requests

    beforeEach(() => {
      req.headers['content-type'] = 'multipart/form-data; boundary=125b0ae93a754d0ba988b98b397d587f'
      // never upload to a real S3 bucket from tests (nock intercepts HTTP for every module instance)
      s3Requests = 0
      nock(/amazonaws\.com/).put(/.*/).reply(200, () => { s3Requests++; return '' }, { ETag: '"test"' })
    })

    it('parses a multipart request', () => {
      req.body = testMultipartBody
      req.session.userId = '42'
      return UploadController.create(req, res)
      .then(() => {
        // busboy parsed the fields and piped the file through to (mocked) S3
        expect(s3Requests).to.equal(1)
        expect(res.body.type).to.equal('userAvatar')
      })
    })
  })
})

// the spec requires the use of CRLF (\r\n), not just \n
// https://www.w3.org/Protocols/rfc1341/7_2_Multipart.html
const testMultipartBody = `--125b0ae93a754d0ba988b98b397d587f\r
Content-Disposition: form-data; name="type"\r
\r
userAvatar\r
--125b0ae93a754d0ba988b98b397d587f\r
Content-Disposition: form-data; name="id"\r
\r
42\r
--125b0ae93a754d0ba988b98b397d587f\r
Content-Disposition: form-data; name="text"; filename="hello.txt"\r
\r
hello world\r
we come in peace\r
\r
--125b0ae93a754d0ba988b98b397d587f--\r
`
