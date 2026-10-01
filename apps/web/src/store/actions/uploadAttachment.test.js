/* eslint-env jest */
import uploadAttachment from './uploadAttachment'

describe('uploadAttachment', () => {
  const attachment = { url: 'https://cdn.example.com/abc', filename: 'photo.png', attachmentType: 'image' }

  it('sends the bucket id when no upload id is given', () => {
    const action = uploadAttachment('post', '12', attachment)
    expect(action.payload.api.params.id).toEqual('12')
    expect(action.meta.id).toEqual('12')
  })

  it('sends the upload id to the server and keeps the bucket id for pending state', () => {
    const action = uploadAttachment('post', 'chat-new', attachment, 'new')
    expect(action.payload.api.params.id).toEqual('new')
    expect(action.meta).toEqual({ type: 'post', id: 'chat-new', attachmentType: 'image' })
  })
})
