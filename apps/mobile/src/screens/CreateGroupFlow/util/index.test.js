import { formatDomainWithUrl, removeDomainFromURL } from './index'

const url = 'foo'
const formattedUrl = `hylo.com/groups/${url}`

describe('formatDomainWithUrl', () => {
  it('works as expected', () => {
    expect(formatDomainWithUrl(url)).toEqual(formattedUrl)
  })
})

describe('removeDomainFromURL', () => {
  it('works as expected', () => {
    expect(removeDomainFromURL(formattedUrl)).toEqual(url)
  })
})
