import { buildDonateUrl, supportThanksUrl } from './supportHylo'

describe('buildDonateUrl', () => {
  it('builds the Open Collective donate URL with presets, the intent tag and the return URL', () => {
    const url = new URL(buildDonateUrl({
      amount: 25,
      interval: 'month',
      tag: 'hylo-abc123',
      redirectUrl: 'https://www.hylo.com/support/thanks'
    }))
    expect(url.origin + url.pathname).toBe('https://opencollective.com/hylo/donate')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      amount: '25',
      interval: 'month',
      tags: 'hylo-abc123',
      redirect: 'https://www.hylo.com/support/thanks'
    })
  })

  it('leaves out the interval for one-time contributions and ignores bad amounts', () => {
    const url = new URL(buildDonateUrl({ amount: 'abc', interval: 'oneTime', tag: 'hylo-x' }))
    expect(url.searchParams.has('interval')).toBe(false)
    expect(url.searchParams.has('amount')).toBe(false)
    expect(url.searchParams.get('tags')).toBe('hylo-x')
  })

  it('supports yearly contributions and another collective slug', () => {
    expect(buildDonateUrl({ slug: 'other', amount: 100, interval: 'year' }))
      .toBe('https://opencollective.com/other/donate?amount=100&interval=year')
  })
})

it('builds the thanks URL on the current origin', () => {
  expect(supportThanksUrl('https://staging.hylo.com')).toBe('https://staging.hylo.com/support/thanks')
})
