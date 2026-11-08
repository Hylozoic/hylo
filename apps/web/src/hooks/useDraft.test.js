/* eslint-env jest */
import { hasPostDraftPayloadContent } from './useDraft'

describe('hasPostDraftPayloadContent', () => {
  it('is false for a location without a title or body', () => {
    expect(hasPostDraftPayloadContent({
      title: '',
      details: '<p></p>',
      location: '23758 East 88th Avenue, Denver, Colorado 80249, United States',
      locationId: '19057'
    })).toBe(false)
  })

  it('is true when there is a title or body, including alongside a location', () => {
    expect(hasPostDraftPayloadContent({ title: 'Hello', details: '', location: 'Denver' })).toBe(true)
    expect(hasPostDraftPayloadContent({ title: '', details: '<p>Notes</p>', location: 'Denver' })).toBe(true)
  })

  it('ignores other metadata when title and body are empty', () => {
    expect(hasPostDraftPayloadContent({
      title: '  ',
      details: '<p></p>',
      meetingLink: 'https://meet.example.com',
      startTime: '2026-10-04T18:00:00.000Z',
      donationsLink: 'https://donate.example.com'
    })).toBe(false)
  })
})
