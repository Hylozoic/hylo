const HTML_TAG_REGEX = /<\/?[a-z][^>]*>/i

const escapeHTML = text => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

/**
 * HTML for a text completion response. Responses from the rich text editor are
 * already HTML; older plain text responses keep their paragraphs and line breaks.
 */
export function completionTextToHTML (text) {
  if (!text || typeof text !== 'string') return ''
  if (HTML_TAG_REGEX.test(text)) return text

  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map(paragraph => `<p>${escapeHTML(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}
