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
  it('strips scripts, event handlers and javascript: links from the output', () => {
    const html = TextHelpers.markdown(
      'hi <img src="x" onerror="alert(1)"><script>alert(2)</script> [click](javascript:alert(3))'
    )
    expect(html).toBe('<p>hi <img src="x"/> <a>click</a></p>\n')
  })
  it('keeps markdown strikethrough and tables', () => {
    expect(TextHelpers.markdown('~~gone~~')).toBe('<p><del>gone</del></p>\n')
    expect(TextHelpers.markdown('| a |\n| - |\n| b |')).toContain('<td>b</td>')
  })
})

describe('insaneOptions', () => {
  const insane = require('insane')

  it('only allows YouTube and Vimeo iframes', () => {
    const html = [
      '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
      '<iframe src="https://player.vimeo.com/video/70509133"></iframe>',
      '<iframe src="https://evil.example/phish"></iframe>',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<iframe src="http://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>'
    ].join('')
    expect(insane(html, TextHelpers.insaneOptions())).toBe(
      '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>' +
      '<iframe src="https://player.vimeo.com/video/70509133"></iframe>'
    )
  })
})

describe('isVideoEmbedURL', () => {
  it('accepts https YouTube and Vimeo player URLs only', () => {
    expect(TextHelpers.isVideoEmbedURL('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true)
    expect(TextHelpers.isVideoEmbedURL('https://player.vimeo.com/video/1?h=abc')).toBe(true)
    expect(TextHelpers.isVideoEmbedURL('https://www.youtube.com.evil.example/embed/x')).toBe(false)
    expect(TextHelpers.isVideoEmbedURL('javascript:alert(1)')).toBe(false)
    expect(TextHelpers.isVideoEmbedURL(undefined)).toBe(false)
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
