import { convert as convertHtmlToText } from 'html-to-text'
import { isURL } from 'validator'
import { marked } from 'marked'
import merge from 'lodash/fp/merge'
import { DateTime } from 'luxon'
import prettyDate from 'pretty-date'
import truncHTML from 'trunc-html'
import truncText from 'trunc-text'

// Sanitization options
export function insaneOptions (providedInsaneOptions) {
  return merge(
    {
      allowedTags: providedInsaneOptions?.allowedTags || [
        'a', 'br', 'em', 'p', 's', 'strong',
        'li', 'ol', 'ul',
        'div', 'iframe', 'mark', 'span',
        'blockquote', 'code', 'hr', 'pre',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
      ],
      allowedAttributes: providedInsaneOptions?.allowedAttributes || {
        a: [
          'class', 'target', 'href',
          'data-type', 'data-id','data-label',
          'data-user-id', 'data-entity-type', 'data-search'
        ],
        span: [
          'class', 'target', 'href',
          'data-type', 'data-id', 'data-label',
          'data-user-id', 'data-entity-type', 'data-search'
        ],
        code: [
          'class'
        ],
        iframe: [
          'src', 'title', 'frameborder', 'height', 'width',
          'allow', 'allowfullscreen'
        ],
        div: [
          'class'
        ]
      }
    },
    providedInsaneOptions
  )
}

export const truncateHTML = (html, truncateLength, providedInsaneOptions = {}) => {
  const options = {
    sanitizer: insaneOptions(providedInsaneOptions)
  }

  return truncHTML(html, truncateLength, options).html
}

export function presentHTMLToText (html, options = {}) {
  if (!html) return ''

  const { truncate: truncateLength, providedConvertHtmlToTextOptions = {} } = options
  const convertHtmlToTextOptions = merge(
    {
      selectors: [
        {
          selector: 'a',
          options: {
            ignoreHref: true
          }
        }
      ]
    },
    providedConvertHtmlToTextOptions
  )

  let processedText = convertHtmlToText(html, convertHtmlToTextOptions)

  if (truncateLength) {
    processedText = truncateText(processedText, truncateLength)
  }

  return processedText
}

export const truncateText = (text, length) => {
  return truncText(text, length)
}

export function textLengthHTML (htmlOrText, options) {
  return presentHTMLToText(htmlOrText, options).length
}

export const markdown = (text, options = {}) => {
  if (options.disableAutolinking) {
    marked.use({
      tokenizer: {
        url (src) {
          // NOTE: having nothing here disables gfm autolinks:
          // https://github.com/markedjs/marked/issues/882#issuecomment-781585009
          // New option coming in later version: https://github.com/sourcegraph/sourcegraph/pull/42203/files
        }
      }
    })
  }

  return marked.parse(text || '', { gfm: true, breaks: true })
}

// HTML Generation Helpers

export const mentionHTML = mentioned => (
  `<span data-type="mention" class="mention" data-id="${mentioned.id}" data-label="${mentioned.name}">${mentioned.name}</span>`
)

export const topicHTML = topicName => (
  `<span data-type="topic" class="topic" data-id="${topicName}" data-label="#${topicName}">${topicName}</span>`
)

// URL helpers

export const sanitizeURL = url => {
  if (!url) return null
  if (isURL(url, { require_protocol: true })) return url
  if (isURL(`https://${url}`)) return `https://${url}`
  return null
}

// Date string related

export function humanDate (date, short) {
  const isString = typeof date === 'string'
  const isValidDate = !isNaN(Number(date)) && Number(date) !== 0
  let ret = date && (isString || isValidDate)
    ? prettyDate.format(isString ? new Date(date) : date)
    : ''

  // Always return 'now' for very recent timestamps
  if (ret === 'just now') {
    return 'now'
  }

  if (short) {
    ret = ret.replace(' ago', '')
  } else {
    if (ret.match(/(\d+) seconds? ago/)) {
      return 'now'
    }
  }

  return ret.replace(/ seconds?/, 's')
    .replace(/ minutes?/, 'm')
    .replace(/ hours?/, 'h')
    .replace(/ days?/, 'd')
    .replace(/ weeks?/, 'w')
    .replace(/ years?/, 'y')
    .replace(/ month(s?)/, ' mo$1')
}

export const formatDatePair = (startTime, endTime, returnAsObj, timezone) => {
  const start = DateTime.fromISO(startTime, {zone: timezone || DateTime.now().zoneName || 'UTC'})
  const end = DateTime.fromISO(endTime, {zone: timezone || DateTime.now().zoneName || 'UTC'})
  const now = DateTime.now()

  const isThisYear = start.get('year') === now.get('year') && end.get('year') === now.get('year')

  let to = ''
  let from = ''

  // TODO post-redesign: This was previously trying to add YYYY if it wasn't this year but that was just adding YYYY to the string
  if (isThisYear) {
    from = endTime ? start.toFormat("EEE, DD 'at' t") : start.toFormat("EEE, DD 'at' t ZZZZ")
  } else {
    from = endTime ? start.toFormat("EEE, DD 'at' t") : start.toFormat("EEE, DD 'at' t ZZZZ")
  }

  if (endTime) {
    if (end.get('year') !== start.get('year')) {
      to = end.toFormat("EEE, DD, yyyy 'at' t ZZZZ")
    } else if (end.get('month') !== start.get('month') ||
               end.get('day') !== start.get('day') ||
               end <= now) {
      to = end.toFormat("EEE, DD 'at' t ZZZZ")
    } else {
      to = end.toFormat('t ZZZZ')
    }
    to = returnAsObj ? to : ' - ' + to
  }

  return returnAsObj ? { from, to } : from + to
}

export function isDateInTheFuture (date) {
  return typeof(date) === 'string' ? DateTime.fromISO(date) : DateTime.fromJSDate(date) > DateTime.now()
}
