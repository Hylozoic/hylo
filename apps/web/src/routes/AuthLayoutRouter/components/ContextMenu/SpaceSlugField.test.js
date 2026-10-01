import { fitSpaceUrl } from './fitSpaceUrl'

const measure = text => text.length * 10

describe('fitSpaceUrl', () => {
  const url = 'hylo.com/groups/regional-energy-and-climate-hub-reach-ca/spaces/san-francisco-bay-area'

  it('returns the full url when it fits', () => {
    expect(fitSpaceUrl(url, measure(url), measure)).toBe(url)
  })

  it('keeps the host and the end of the url with an ellipsis in the middle', () => {
    const fitted = fitSpaceUrl(url, 400, measure)
    expect(fitted).toBe('hylo.com/…/spaces/san-francisco-bay-area')
    expect(measure(fitted)).toBeLessThanOrEqual(400)
  })

  it('snaps a partial path segment back to the next slash', () => {
    const fitted = fitSpaceUrl(url, 410, measure)
    expect(fitted).toBe('hylo.com/…/spaces/san-francisco-bay-area')
  })

  it('drops characters from the middle of the tail before the end of the slug', () => {
    const fitted = fitSpaceUrl(url, 300, measure)
    expect(fitted.startsWith('hylo.com/…')).toBe(true)
    expect(fitted.endsWith('francisco-bay-area')).toBe(true)
    expect(measure(fitted)).toBeLessThanOrEqual(300)
  })
})
