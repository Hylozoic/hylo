import inflection from 'inflection'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn (...inputs) {
  return twMerge(clsx(inputs))
}

export function bgImageStyle (url) {
  if (!url) return {}
  const escaped = url.replace(/([\(\)])/g, (match, $1) => '\\' + $1) // eslint-disable-line
  return { backgroundImage: `url(${escaped})` }
}

export const dispatchEvent = (el, etype) => {
  const evObj = document.createEvent('Events')
  evObj.initEvent(etype, true, false)
  el.dispatchEvent(evObj)
}

export function isPromise (value) {
  return value && typeof value.then === 'function'
}

export const inflectedTotal = (word, count) => `${count.toLocaleString()} ${inflection.inflect(word, count)}`

export function hexToRgb (hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ]
    : null
}

export function inIframe () {
  return window.location !== window.parent.location
}

// TOOD: Move to HyloShared and reconcile with use of `validator.isEmail` in Mobile
/* eslint-disable */
export const validateEmail = email => {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  return re.test(email.toLowerCase())
}

/**
 * Parse a date value coming from the API. Date fields are declared as GraphQL
 * `String`, so they arrive as epoch milliseconds in a string ("1787331729720")
 * rather than ISO — `new Date()` cannot parse that form on its own.
 * Returns null for missing or unparseable values.
 */
export function parseApiDate (value) {
  if (!value) return null
  const date = value instanceof Date
    ? value
    : /^\d+$/.test(String(value))
      ? new Date(parseInt(value, 10))
      : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
