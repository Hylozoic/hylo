import upload from 'store/actions/upload'
import apiHost from 'util/apiHost'
import Request from 'util/Request'

const file = {
  uri: 'file:///tmp/foo.jpg',
  name: 'foo.jpg'
}

const append = jest.fn()
const open = jest.fn()

class mockFormData {
  constructor () {
    this.append = append
  }
}

let requestShouldFail

class mockXMLHttpRequest {
  constructor () {
    this.open = open
  }

  send () {
    if (requestShouldFail) {
      this.status = 400
      this.responseText = 'Inauspicious timing'
      this.onerror()
    } else {
      this.status = 200
      this.responseText = '{"url": "https://images.hylo.com/bar.jpg"}'
      this.onload()
    }
  }

  getAllResponseHeaders () {
    return 'Content-Type: application/json'
  }

  getResponseHeader (key) {
    if (key === 'Content-Type') return 'application/json'
  }
}

let originalXMLHttpRequest, originalFormData

beforeAll(() => {
  originalXMLHttpRequest = Request.XMLHttpRequest
  Request.XMLHttpRequest = mockXMLHttpRequest
  originalFormData = Request.FormData
  Request.FormData = mockFormData
})

afterAll(() => {
  Request.XMLHttpRequest = originalXMLHttpRequest
  Request.FormData = originalFormData
})

it('works as expected', async () => {
  const action = upload('userAvatar', '11', file)
  expect(action.meta).toMatchSnapshot()
  expect(action.type).toEqual('UPLOAD')
  expect(open).toBeCalledWith('POST', apiHost + '/noo/upload')
  expect(append.mock.calls).toEqual([
    ['type', 'userAvatar'],
    ['id', '11'],
    ['file', { uri: 'file:///tmp/foo.jpg', name: 'foo.jpg' }]
  ])

  const result = await action.payload
  expect(result).toEqual({ url: 'https://images.hylo.com/bar.jpg' })
})

it('handles failure', async () => {
  requestShouldFail = true
  expect.assertions(1)

  try {
    await upload('userAvatar', '11', file).payload
  } catch (err) {
    expect(err.message).toEqual('Inauspicious timing')
  }
})
