import { completionTextToHTML } from './completionResponse'

describe('completionTextToHTML', () => {
  it('returns editor HTML unchanged', () => {
    const html = '<p>One</p><ul><li><p>Two</p></li></ul>'
    expect(completionTextToHTML(html)).toEqual(html)
  })

  it('keeps paragraphs and line breaks in plain text', () => {
    expect(completionTextToHTML('First line\nsecond line\n\nNew paragraph'))
      .toEqual('<p>First line<br>second line</p><p>New paragraph</p>')
  })

  it('escapes plain text that looks like markup', () => {
    expect(completionTextToHTML('1 < 2 & 3 > 2')).toEqual('<p>1 &lt; 2 &amp; 3 &gt; 2</p>')
  })

  it('handles empty values', () => {
    expect(completionTextToHTML('')).toEqual('')
    expect(completionTextToHTML(null)).toEqual('')
  })
})
