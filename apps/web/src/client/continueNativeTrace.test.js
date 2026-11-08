import * as Sentry from '@sentry/react'
import continueNativeTrace from './continueNativeTrace'

const nativeTraceId = '0123456789abcdef0123456789abcdef'
const nativeSpanId = '0123456789abcdef'

function addMeta (name, content) {
  const meta = document.createElement('meta')
  meta.setAttribute('name', name)
  meta.setAttribute('content', content)
  document.head.appendChild(meta)
}

describe('continueNativeTrace', () => {
  let sentEvents

  beforeEach(() => {
    document.head.innerHTML = ''
    sentEvents = []
    Sentry.getCurrentScope().clear()
    Sentry.init({
      dsn: 'https://public@o1.ingest.sentry.io/1',
      tracesSampleRate: 0,
      defaultIntegrations: false,
      beforeSend: (event) => {
        sentEvents.push(event)
        return null
      }
    })
  })

  afterEach(async () => {
    await Sentry.close()
  })

  it('gives web errors the native trace id from the injected meta tags', async () => {
    addMeta('sentry-trace', `${nativeTraceId}-${nativeSpanId}`)
    addMeta('baggage', `sentry-trace_id=${nativeTraceId},sentry-environment=production,sentry-release=hyloleap@7.1.0`)

    expect(continueNativeTrace()).toBe(true)
    Sentry.captureException(new Error('web error inside the mobile app'))
    await Sentry.flush()

    expect(sentEvents).toHaveLength(1)
    expect(sentEvents[0].contexts.trace.trace_id).toBe(nativeTraceId)
    expect(sentEvents[0].contexts.trace.parent_span_id).toBe(nativeSpanId)
    // No tracing integration, so continuing the trace starts no spans
    expect(Sentry.getActiveSpan()).toBeUndefined()
  })

  it('keeps the native sampling decision rather than making a new one', () => {
    addMeta('sentry-trace', `${nativeTraceId}-${nativeSpanId}-0`)
    continueNativeTrace()
    expect(Sentry.getCurrentScope().getPropagationContext().sampled).toBe(false)
  })

  it('leaves the trace alone when there is no native trace meta tag', () => {
    const before = Sentry.getCurrentScope().getPropagationContext().traceId

    expect(continueNativeTrace()).toBe(false)
    expect(Sentry.getCurrentScope().getPropagationContext().traceId).toBe(before)
  })
})
