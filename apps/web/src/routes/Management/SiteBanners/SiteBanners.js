import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { origin } from '@hylo/navigation'
import HyloEditor from 'components/HyloEditor/HyloEditor'
import HyloHTML from 'components/HyloHTML/HyloHTML'
import Loading from 'components/Loading'
import Button from 'components/ui/button'
import { Input } from 'components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select'
import { Switch } from 'components/ui/switch'
import { internalPathname } from 'components/ClickCatcher/ClickCatcher'
import { normalizeUserLinkHref } from 'util/url'
import { cn } from 'util/index'
import {
  fetchAllSiteBanners,
  createSiteBanner,
  updateSiteBanner,
  publishSiteBanner,
  unpublishSiteBanner,
  deleteSiteBanner
} from 'store/actions/siteBanners'

const TYPE_OPTIONS = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'alert', label: 'Alert' }
]

// English is the banner's own text and the fallback; the others are translations
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'hi', label: 'Hindi' },
  { code: 'pt', label: 'Portuguese' }
]
const TRANSLATION_CODES = LANGUAGES.map(l => l.code).filter(code => code !== 'en')

const EMPTY_DRAFT = { id: null, status: 'draft', title: '', text: '', type: 'info', actionText: '', actionUrl: '', showToNewUsers: false, translations: {}, lang: 'en' }

// Stored translations use action_text; the form uses actionText
function translationsFromBanner (stored = {}) {
  const result = {}
  TRANSLATION_CODES.forEach(code => {
    const entry = stored?.[code]
    if (entry) result[code] = { title: entry.title || '', text: entry.text || '', actionText: entry.action_text || '' }
  })
  return result
}

function translationsForSave (translations = {}) {
  const result = {}
  TRANSLATION_CODES.forEach(code => {
    const entry = translations[code]
    if (!entry) return
    const clean = {}
    if (entry.title?.trim()) clean.title = entry.title.trim()
    if (entry.text?.trim()) clean.text = entry.text
    if (entry.actionText?.trim()) clean.actionText = entry.actionText.trim()
    if (Object.keys(clean).length) result[code] = clean
  })
  return result
}

/** Share of people who handled the banner by using its button, as a whole percentage. */
export function clickThroughRate (clicked = 0, dismissed = 0) {
  const total = (clicked || 0) + (dismissed || 0)
  return total > 0 ? Math.round((clicked / total) * 100) : 0
}

function statusOf (banner) {
  if (banner.unpublishedAt) return 'unpublished'
  if (banner.publishedAt) return 'published'
  return 'draft'
}

/**
 * Superadmin page to compose, publish, and take down site-wide banners.
 */
export default function SiteBanners () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const editorRef = useRef(null)
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const loadBanners = useCallback(() => {
    return dispatch(fetchAllSiteBanners()).then(result => {
      const items = result?.payload?.data?.allSiteBanners
      if (Array.isArray(items)) setBanners(items)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [dispatch])

  useEffect(() => {
    loadBanners()
  }, [loadBanners])

  const resetDraft = useCallback(() => {
    setDraft(EMPTY_DRAFT)
    editorRef.current?.clearContent()
  }, [])

  // The editor shows one language at a time; this reads what's in it now
  const editorHTML = () => (editorRef.current && !editorRef.current.isEmpty()) ? editorRef.current.getHTML() : ''

  // Store the editor's text under a language, returning the updated draft
  const withEditorText = (d, lang) => lang === 'en'
    ? { ...d, text: editorHTML() }
    : { ...d, translations: { ...d.translations, [lang]: { ...(d.translations[lang] || {}), text: editorHTML() } } }

  const switchLanguage = useCallback((next) => {
    if (next === draft.lang) return
    const saved = withEditorText(draft, draft.lang)
    const nextText = next === 'en' ? saved.text : (saved.translations[next]?.text || '')
    setDraft({ ...saved, lang: next })
    if (nextText) editorRef.current?.setContent(nextText)
    else editorRef.current?.clearContent()
  }, [draft])

  // Title and button text for the language being edited
  const current = draft.lang === 'en'
    ? { title: draft.title, actionText: draft.actionText }
    : { title: draft.translations[draft.lang]?.title || '', actionText: draft.translations[draft.lang]?.actionText || '' }

  const setCurrentField = (field, value) => setDraft(d => d.lang === 'en'
    ? { ...d, [field]: value }
    : { ...d, translations: { ...d.translations, [d.lang]: { ...(d.translations[d.lang] || {}), [field]: value } } })

  const actionHint = draft.actionUrl
    ? (internalPathname(normalizeUserLinkHref(draft.actionUrl), origin())
        ? t('Opens in Hylo: {{path}}', { path: internalPathname(normalizeUserLinkHref(draft.actionUrl), origin()) })
        : t('Opens in a new tab'))
    : null

  const handleSave = useCallback(async (publish) => {
    const latest = withEditorText(draft, draft.lang)
    const text = latest.text
    if (!text) {
      setError(t('Please write a message for the banner'))
      return
    }
    if (!!latest.actionText !== !!latest.actionUrl) {
      setError(t('Action Button Text and Action Button URL must be set together'))
      return
    }

    setError(null)
    setSaving(true)
    try {
      const data = {
        title: latest.title || null,
        text,
        type: latest.type,
        actionText: latest.actionText || null,
        actionUrl: latest.actionUrl || null,
        showToNewUsers: !!latest.showToNewUsers,
        translations: translationsForSave(latest.translations)
      }
      const result = draft.id
        ? await dispatch(updateSiteBanner(draft.id, data))
        : await dispatch(createSiteBanner(data))

      const saved = result?.payload?.data?.updateSiteBanner || result?.payload?.data?.createSiteBanner
      if (result?.error || !saved) {
        setError(t('Something went wrong saving the banner'))
        return
      }

      if (publish) {
        await dispatch(publishSiteBanner(saved.id))
      }

      resetDraft()
      await loadBanners()
    } finally {
      setSaving(false)
    }
  }, [dispatch, draft, loadBanners, resetDraft, t])

  const handleEdit = useCallback((banner) => {
    setDraft({
      id: banner.id,
      status: statusOf(banner),
      title: banner.title || '',
      text: banner.text || '',
      type: banner.type,
      actionText: banner.actionText || '',
      actionUrl: banner.actionUrl || '',
      showToNewUsers: !!banner.showToNewUsers,
      translations: translationsFromBanner(banner.translations),
      lang: 'en'
    })
    editorRef.current?.setContent(banner.text)
  }, [])

  const handlePublish = useCallback(async (id) => {
    await dispatch(publishSiteBanner(id))
    loadBanners()
  }, [dispatch, loadBanners])

  const handleUnpublish = useCallback(async (id) => {
    if (!window.confirm(t('Take down this banner? Users will stop seeing it.'))) return
    await dispatch(unpublishSiteBanner(id))
    loadBanners()
  }, [dispatch, loadBanners, t])

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm(t('Delete this draft banner?'))) return
    await dispatch(deleteSiteBanner(id))
    loadBanners()
  }, [dispatch, loadBanners, t])

  const statusLabel = (banner) => {
    if (banner.unpublishedAt) return t('Taken down {{date}}', { date: new Date(banner.unpublishedAt).toLocaleString() })
    if (banner.publishedAt) return t('Published {{date}}', { date: new Date(banner.publishedAt).toLocaleString() })
    return t('Draft')
  }

  return (
    <div className='p-6 max-w-4xl mx-auto'>
      <h1 className='text-2xl font-bold mb-6'>{t('Site Banners')}</h1>

      <div className='mb-8 border border-foreground/20 rounded-md p-4'>
        <h2 className='text-lg font-semibold mb-4'>{draft.id ? t('Edit Banner') : t('New Banner')}</h2>

        <div className='mb-4'>
          <label className='block text-sm font-medium mb-1'>{t('Language')}</label>
          <div className='flex flex-wrap gap-2' role='tablist' data-testid='banner-languages'>
            {LANGUAGES.map(language => {
              const hasText = language.code === 'en'
                ? true
                : !!(draft.translations[language.code]?.title || draft.translations[language.code]?.text || draft.translations[language.code]?.actionText)
              return (
                <button
                  key={language.code}
                  type='button'
                  role='tab'
                  aria-selected={draft.lang === language.code}
                  onClick={() => switchLanguage(language.code)}
                  className={cn(
                    'px-3 py-1 rounded-md border-2 text-sm transition-all',
                    draft.lang === language.code ? 'border-secondary text-foreground' : 'border-foreground/20 text-foreground-muted hover:border-foreground/50',
                    !hasText && 'border-dashed'
                  )}
                >
                  {t(language.label)}
                </button>
              )
            })}
          </div>
          {draft.lang !== 'en' && (
            <p className='text-xs text-foreground-muted mt-1'>{t('Leave a field blank to show the English text in this language.')}</p>
          )}
        </div>

        <div className='mb-4'>
          <label className='block text-sm font-medium mb-1'>{t('Title')}</label>
          <Input
            value={current.title}
            onChange={e => setCurrentField('title', e.target.value)}
            placeholder={draft.lang === 'en' ? t('Optional') : (draft.title || t('Optional'))}
          />
        </div>

        <div className='mb-4 border border-input rounded-md'>
          <HyloEditor
            ref={editorRef}
            placeholder={t('Write the announcement...')}
            showMenu
          />
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4'>
          <div>
            <label className='block text-sm font-medium mb-1'>{t('Type')}</label>
            <Select value={draft.type} onValueChange={value => setDraft(d => ({ ...d, type: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{t(opt.label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className='block text-sm font-medium mb-1'>{t('Action Button Text')}</label>
            <Input
              value={current.actionText}
              onChange={e => setCurrentField('actionText', e.target.value)}
              placeholder={draft.lang === 'en' ? t('e.g. Learn more') : (draft.actionText || t('e.g. Learn more'))}
            />
          </div>
          <div>
            <label className='block text-sm font-medium mb-1'>{t('Action Button URL')}</label>
            <Input
              value={draft.actionUrl}
              onChange={e => setDraft(d => ({ ...d, actionUrl: e.target.value }))}
              placeholder='https://... or /groups/...'
            />
            {actionHint && <p className='text-xs text-foreground-muted mt-1'>{actionHint}</p>}
          </div>
        </div>

        <div className='flex items-center justify-between gap-4 mb-4'>
          <div className='space-y-1'>
            <label className='block text-sm font-medium'>{t('Show to new users')}</label>
            <p className='text-xs text-foreground-muted'>
              {t('People who join Hylo after this banner is published will also see it.')}
            </p>
          </div>
          <Switch
            checked={!!draft.showToNewUsers}
            onCheckedChange={checked => setDraft(d => ({ ...d, showToNewUsers: !!checked }))}
          />
        </div>

        {error && <p className='text-sm text-destructive mb-4'>{error}</p>}

        <div className='flex gap-2'>
          {draft.status === 'draft' && (
            <>
              <Button variant='default' disabled={saving} onClick={() => handleSave(true)}>
                {t('Publish now')}
              </Button>
              <Button variant='secondary' disabled={saving} onClick={() => handleSave(false)}>
                {t('Save as draft')}
              </Button>
            </>
          )}
          {draft.status === 'published' && (
            <Button variant='default' disabled={saving} onClick={() => handleSave(false)}>
              {t('Save changes')}
            </Button>
          )}
          {draft.status === 'unpublished' && (
            <>
              <Button variant='default' disabled={saving} onClick={() => handleSave(true)}>
                {t('Save & Republish')}
              </Button>
              <Button variant='secondary' disabled={saving} onClick={() => handleSave(false)}>
                {t('Save changes')}
              </Button>
            </>
          )}
          {draft.id && (
            <Button variant='ghost' disabled={saving} onClick={resetDraft}>
              {t('Cancel')}
            </Button>
          )}
        </div>
      </div>

      <div>
        <h2 className='text-lg font-semibold mb-4'>{t('All Banners')}</h2>
        {loading
          ? <Loading />
          : banners.length === 0
            ? <div className='text-foreground-muted p-4 border border-foreground/20 rounded-md'>{t('No banners yet.')}</div>
            : (
              <ul className='divide-y divide-foreground/10 border border-foreground/20 rounded-md'>
                {banners.map(banner => (
                  <li key={banner.id} className='p-4'>
                    <div className='flex items-start justify-between gap-4'>
                      <div className='min-w-0 flex-1'>
                        {banner.title && <p className='font-bold mb-1'>{banner.title}</p>}
                        <HyloHTML className='text-sm mb-1' html={banner.text} />
                        {banner.actionText && (
                          <p className='text-xs text-foreground-muted mb-1'>
                            {t('Button')}: {banner.actionText} &rarr; {banner.actionUrl}
                          </p>
                        )}
                        <p className='text-xs text-foreground-muted'>
                          {statusLabel(banner)}
                          {banner.creator?.name && ` · ${t('by')} ${banner.creator.name}`}
                          {banner.showToNewUsers ? ` · ${t('Shown to new users')}` : ''}
                        </p>
                        {banner.publishedAt && typeof banner.dismissedCount === 'number' && (
                          <p className='text-xs text-foreground/70 mt-1' data-testid='banner-stats'>
                            {t('{{count}} dismissed', { count: banner.dismissedCount })}
                            {banner.actionText && typeof banner.clickedCount === 'number' && (
                              ` · ${t('{{count}} clicked', { count: banner.clickedCount })} · ${t('{{percent}}% click-through', { percent: clickThroughRate(banner.clickedCount, banner.dismissedCount) })}`
                            )}
                          </p>
                        )}
                        {Object.keys(banner.translations || {}).length > 0 && (
                          <p className='text-xs text-foreground-muted mt-1'>
                            {t('Translated into: {{languages}}', {
                              languages: LANGUAGES.filter(l => banner.translations[l.code]).map(l => t(l.label)).join(', ')
                            })}
                          </p>
                        )}
                      </div>
                      <div className='flex gap-2 shrink-0'>
                        {!banner.publishedAt && (
                          <>
                            <Button variant='secondary' size='sm' onClick={() => handlePublish(banner.id)}>{t('Publish')}</Button>
                            <Button variant='ghost' size='sm' onClick={() => handleEdit(banner)}>{t('Edit')}</Button>
                            <Button variant='ghost' size='sm' onClick={() => handleDelete(banner.id)}>{t('Delete')}</Button>
                          </>
                        )}
                        {banner.publishedAt && !banner.unpublishedAt && (
                          <>
                            <Button variant='ghost' size='sm' onClick={() => handleEdit(banner)}>{t('Edit')}</Button>
                            <Button variant='destructive' size='sm' onClick={() => handleUnpublish(banner.id)}>{t('Take down')}</Button>
                          </>
                        )}
                        {banner.publishedAt && banner.unpublishedAt && (
                          <>
                            <Button variant='ghost' size='sm' onClick={() => handleEdit(banner)}>{t('Edit')}</Button>
                            <Button variant='secondary' size='sm' onClick={() => handlePublish(banner.id)}>{t('Republish')}</Button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              )}
      </div>
    </div>
  )
}
