/**
 * Strips markdown and HTML down to truncated plain text for OG / meta tags.
 * Kept local so the Vite config can load this pipeline without pulling
 * @hylo/shared (which triggers MODULE_TYPELESS_PACKAGE_JSON warnings).
 */
export function toPlainText (value, truncateLength) {
  if (!value) return ''

  const text = String(value)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (truncateLength && text.length > truncateLength) {
    return `${text.slice(0, truncateLength - 1).trimEnd()}…`
  }

  return text
}
