import { getMediaTypeFromMimetype } from '../../../../api/models/media/util'

describe('getMediaTypeFromMimetype', () => {
  it('keeps an uploaded video as a file attachment', () => {
    expect(getMediaTypeFromMimetype('video/mp4')).to.equal('file')
    expect(getMediaTypeFromMimetype('video/quicktime')).to.equal('file')
    expect(getMediaTypeFromMimetype('video/webm')).to.equal('file')
  })

  it('keeps images as images and other uploads as files', () => {
    expect(getMediaTypeFromMimetype('image/png')).to.equal('image')
    expect(getMediaTypeFromMimetype('image/jpeg')).to.equal('image')
    expect(getMediaTypeFromMimetype('application/pdf')).to.equal('file')
    expect(getMediaTypeFromMimetype('audio/mpeg')).to.equal('file')
    expect(getMediaTypeFromMimetype('text/plain')).to.equal('file')
    expect(getMediaTypeFromMimetype(undefined)).to.equal('file')
  })
})
