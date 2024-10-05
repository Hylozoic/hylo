import apiHost from 'util/apiHost'
import Request from 'util/Request'
import { UPLOAD } from 'store/constants'

export default function upload (type, id, file) {
  const url = apiHost + '/noo/upload'

  const request = Request.create(url, 'POST')
    .set('type', type)
    .set('id', id || 'new')
    .set('file', file)

  const payload = request.send()
    .then(resp => {
      const { status, text } = resp
      if (status === 200) return JSON.parse(text)

      let error
      try {
        error = new Error(JSON.parse(text).message)
      } catch (err) {
        error = new Error(text)
      }

      error.response = { status }
      throw error
    })
    .catch(err => {
      if (err.text && err.text.match(/sendto failed/)) {
        throw new Error('Please check your network connection and try again.')
      }

      throw err
    })

  return { type: UPLOAD, payload, meta: { type, id } }
}
