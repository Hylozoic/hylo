import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import importGroupThemeFromUrl from 'store/actions/importGroupThemeFromUrl'
import { addImportUsage, formatUsd, normalizeImportUrl } from 'util/groupThemeEditor'

// Measured on real imports with the default model (Claude Opus 5.5 at $4 / $20 per
// million tokens): 5,600 to 6,900 tokens and $0.028 to $0.031 each. Shown before the
// first import; afterwards the real numbers from the server replace it.
const TYPICAL_IMPORT = { tokens: 6000, costUsd: 0.03 }

/**
 * "Start from a website": sends a link to the server, which reads the site's
 * look with a headless browser and an AI model, and hands the suggestion to
 * the editor as an unsaved draft. Shows what each import cost in tokens and
 * dollars, and the running total for this visit to the page.
 */
export default function GroupThemeImport ({ groupId, onImport, disabled = false }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [last, setLast] = useState(null)
  const [session, setSession] = useState({ count: 0, tokens: 0, costUsd: 0, costKnown: true })

  const target = normalizeImportUrl(url)

  const handleSubmit = async event => {
    event.preventDefault()
    if (!target || loading || disabled) return
    setLoading(true)
    setError(null)
    try {
      const response = await dispatch(importGroupThemeFromUrl(groupId, target))
      if (response?.error) throw response.payload || new Error(t('Something went wrong. Please try again.'))
      const result = response?.payload?.data?.importGroupThemeFromUrl
      if (!result?.roles) throw new Error(t('Something went wrong. Please try again.'))
      onImport(result)
      setLast(result)
      if (result.usage) setSession(current => addImportUsage(current, result.usage))
    } catch (err) {
      setError(t('Could not import a theme: {{message}}', { message: err?.message || String(err) }))
    } finally {
      setLoading(false)
    }
  }

  const cost = value => value === null || value === undefined
    ? t('cost unknown')
    : t('about {{cost}}', { cost: formatUsd(value) })
  const usage = last?.usage

  return (
    <div className='mb-6 rounded-lg border-2 border-foreground/10 p-4' data-testid='group-theme-import'>
      <label htmlFor='group-theme-import-url' className='text-sm font-medium mb-1 flex items-center gap-1'>
        <Sparkles className='h-4 w-4 text-accent' />
        {t('Start from a website')}
      </label>
      <p className='text-xs text-foreground/60 mb-2'>
        {t("Paste a link and AI will suggest colors, corners, borders and fonts from that site's look. You can adjust everything before saving.")}
      </p>
      <form onSubmit={handleSubmit} className='flex flex-wrap items-center gap-2'>
        <input
          id='group-theme-import-url'
          type='text'
          inputMode='url'
          autoComplete='off'
          value={url}
          onChange={event => setUrl(event.target.value)}
          placeholder='https://example.org'
          disabled={loading || disabled}
          className='flex-1 min-w-[12rem] rounded-md border-2 border-foreground/20 bg-input text-foreground px-3 py-1 text-sm'
        />
        <button
          type='submit'
          disabled={!target || loading || disabled}
          className='rounded-md bg-primary text-primary-foreground px-3 py-1 text-sm font-bold border-2 border-transparent disabled:opacity-50'
        >
          {loading ? t('Reading the site...') : t('Import look')}
        </button>
      </form>
      {loading && <p className='text-xs text-foreground/60 mt-2' role='status'>{t('This usually takes 10 to 20 seconds.')}</p>}
      {error && <p className='text-xs text-destructive mt-2' role='alert'>{error}</p>}
      {last && !loading && !error && (
        <p className='text-xs text-foreground/70 mt-2' data-testid='group-theme-import-summary'>
          {t('Imported from {{site}}. Review it below, then save.', { site: last.sourceUrl })} {last.summary}
        </p>
      )}
      <div className='mt-3 rounded-md border-2 border-foreground/10 bg-muted/50 px-3 py-2 text-xs text-foreground/70' data-testid='group-theme-import-usage'>
        <p className='m-0 font-bold text-foreground'>{t('AI usage and cost')}</p>
        {!usage && (
          <p className='m-0'>
            {t('Each import costs about {{cost}} (around {{tokens}} tokens with Claude Opus 5.5). The exact tokens and cost appear here after each import.', {
              cost: formatUsd(TYPICAL_IMPORT.costUsd),
              tokens: TYPICAL_IMPORT.tokens.toLocaleString()
            })}
          </p>
        )}
        {usage && (
          <>
            <p className='m-0'>
              {t('This import: {{input}} input and {{output}} output tokens', {
                input: usage.inputTokens.toLocaleString(),
                output: usage.outputTokens.toLocaleString()
              })}, {cost(usage.estimatedCostUsd)}
            </p>
            <p className='m-0'>
              {t('This visit: {{count}} imports, {{tokens}} tokens', {
                count: session.count,
                tokens: session.tokens.toLocaleString()
              })}, {cost(session.costKnown ? session.costUsd : null)}
            </p>
            <p className='m-0 text-foreground/50'>
              {usage.pricePerMillionTokens
                ? t('Model {{model}}, priced at {{input}} per million input tokens and {{output}} per million output tokens. Costs are estimates.', {
                  model: usage.model,
                  input: formatUsd(usage.pricePerMillionTokens.input),
                  output: formatUsd(usage.pricePerMillionTokens.output)
                })
                : t('Model {{model}}. No price is on file for this model.', { model: usage.model })}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
