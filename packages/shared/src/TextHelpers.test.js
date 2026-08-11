import * as TextHelpers from '../src/TextHelpers'
import { DateTime } from 'luxon'

describe('presentHTMLToText', () => {
  it("shouldn't include text of href on links", () => {
    expect(TextHelpers.presentHTMLToText("<a href='/any/url'>Text</a> more text")).toBe('Text more text')
  })
})

describe('truncateText', () => {
  it('has an ellipses after truncation', () => {
    expect(TextHelpers.truncateText('<I mean it> test test test', 8)).toBe('<I mean …')
  })

  it('does not have an ellipses if there was no truncation', () => {
    expect(TextHelpers.truncateText('<I mean it> test test test', 100)).toBe('<I mean it> test test test')
  })
})

describe('textLengthHTML', () => {
  it('should return lenght of plain text version of the html', () => {
    expect(TextHelpers.textLengthHTML('<strong>test</strong> <a href="">a link</a>')).toBe(11)
  })
})

describe('markdown', () => {
  it('converts to markdown', () => {
    expect(TextHelpers.markdown('*strong* **italic**')).toBe('<p><em>strong</em> <strong>italic</strong></p>\n')
  })
  it('converts to markdown with autolinking (default)', () => {
    expect(TextHelpers.markdown('https://www.hylo.com')).toBe('<p><a href="https://www.hylo.com">https://www.hylo.com</a></p>\n')
  })
  it('converts to markdown with disableAutolinking', () => {
    expect(TextHelpers.markdown('https://www.hylo.com', { disableAutolinking: true })).toBe('<p>https://www.hylo.com</p>\n')
  })
  it('converts to markdown in paragraphs', () => {
    expect(TextHelpers.markdown('asdw\n\n\nasdf')).toBe('<p>asdw</p>\n<p>asdf</p>\n')
  })
})

describe('sanitizeURL', () => {
  it('adds "https" when no protocol specified', () => {
    expect(TextHelpers.sanitizeURL('www.hylo.com')).toBe('https://www.hylo.com')
  })
})

describe('isDateInTheFuture', () => {
  const past = DateTime.now().minus({ years: 1 })
  const future = DateTime.now().plus({ years: 1 })

  it('returns false for a past ISO string', () => {
    expect(TextHelpers.isDateInTheFuture(past.toISO())).toBe(false)
  })

  it('returns true for a future ISO string', () => {
    expect(TextHelpers.isDateInTheFuture(future.toISO())).toBe(true)
  })

  it('returns false for a past Date', () => {
    expect(TextHelpers.isDateInTheFuture(past.toJSDate())).toBe(false)
  })

  it('returns true for a future Date', () => {
    expect(TextHelpers.isDateInTheFuture(future.toJSDate())).toBe(true)
  })

  it('returns false for an unparseable string', () => {
    expect(TextHelpers.isDateInTheFuture('not a date')).toBe(false)
  })

  it('returns false when there is no date', () => {
    expect(TextHelpers.isDateInTheFuture(null)).toBe(false)
    expect(TextHelpers.isDateInTheFuture(undefined)).toBe(false)
  })
})
