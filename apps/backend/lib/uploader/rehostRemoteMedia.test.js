/* eslint-disable no-unused-expressions */
import { isHyloHostedUrl, partitionImageUrls } from './rehostRemoteMedia'

describe('isHyloHostedUrl', () => {
  const originalContentUrl = process.env.AWS_S3_CONTENT_URL
  const originalHost = process.env.UPLOADER_HOST

  afterEach(() => {
    process.env.AWS_S3_CONTENT_URL = originalContentUrl
    process.env.UPLOADER_HOST = originalHost
  })

  it('returns false for empty values', () => {
    expect(isHyloHostedUrl()).to.equal(false)
    expect(isHyloHostedUrl('')).to.equal(false)
    expect(isHyloHostedUrl(null)).to.equal(false)
  })

  it('returns true for evo-uploads paths', () => {
    expect(isHyloHostedUrl('https://cdn.hylo.com/evo-uploads/user/1/post/new/pic.png')).to.equal(true)
  })

  it('returns true when the URL starts with AWS_S3_CONTENT_URL', () => {
    process.env.AWS_S3_CONTENT_URL = 'https://hylo-media.s3.amazonaws.com'
    expect(isHyloHostedUrl('https://hylo-media.s3.amazonaws.com/foo.png')).to.equal(true)
  })

  it('returns true when the URL includes UPLOADER_HOST', () => {
    process.env.UPLOADER_HOST = 'd3ngex8q79bk55.cloudfront.net'
    expect(isHyloHostedUrl('https://d3ngex8q79bk55.cloudfront.net/something.png')).to.equal(true)
  })

  it('returns false for Airtable and other remote URLs', () => {
    expect(isHyloHostedUrl('https://v5.airtableusercontent.com/v1/foo/photo.jpg')).to.equal(false)
    expect(isHyloHostedUrl('https://example.com/pic.png')).to.equal(false)
  })
})

describe('partitionImageUrls', () => {
  it('leaves hosted absent when urls are absent so updates do not clear images', () => {
    expect(partitionImageUrls(undefined)).to.deep.equal({ hosted: undefined, remote: [] })
    expect(partitionImageUrls(null)).to.deep.equal({ hosted: null, remote: [] })
  })

  it('splits hosted and remote URLs and skips blanks', () => {
    const hosted = 'https://cdn.hylo.com/evo-uploads/user/1/post/new/a.png'
    const remote = 'https://v5.airtableusercontent.com/v1/foo/photo.jpg'
    expect(partitionImageUrls([hosted, '', remote, null])).to.deep.equal({
      hosted: [hosted],
      remote: [remote]
    })
  })

  it('splits a pasted block of URLs into multiple remote images', () => {
    const wiki = 'https://upload.wikimedia.org/wikipedia/commons/cow.jpg'
    const google = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:abc'
    expect(partitionImageUrls(`${wiki}\n${google}`)).to.deep.equal({
      hosted: [],
      remote: [wiki, google]
    })
  })
})
