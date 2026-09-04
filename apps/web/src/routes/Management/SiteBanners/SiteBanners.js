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
import { internalPathname } from 'components/ClickCatcher/ClickCatcher'
import { normalizeUserLinkHref } from 'util/url'
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

const EMPTY_DRAFT = { id: null, status: 'draft', title: '', type: 'info', actionText: '', actionUrl: '' }

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
      if (items) setBanners(items)
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

  const actionHint = draft.actionUrl
    ? (internalPathname(normalizeUserLinkHref(draft.actionUrl), origin())
        ? t('Opens in Hylo: {{path}}', { path: internalPathname(normalizeUserLinkHref(draft.actionUrl), origin()) })
        : t('Opens in a new tab'))
    : null

  const handleSave = useCallback(async (publish) => {
    const text = editorRef.current?.getHTML()
    if (!text || editorRef.current?.isEmpty()) {
      setError(t('Please write a message for the banner'))
      return
    }
    if (!!draft.actionText !== !!draft.actionUrl) {
      setError(t('Action Button Text and Action Button URL must be set together'))
      return
    }

    setError(null)
    setSaving(true)
    try {
      const data = {
        title: draft.title || null,
        text,
        type: draft.type,
        actionText: draft.actionText || null,
        actionUrl: draft.actionUrl || null
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
    setDraft({ id: banner.id, status: statusOf(banner), title: banner.title || '', type: banner.type, actionText: banner.actionText || '', actionUrl: banner.actionUrl || '' })
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
          <label className='block text-sm font-medium mb-1'>{t('Title')}</label>
          <Input
            value={draft.title}
            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            placeholder={t('Optional')}
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
              value={draft.actionText}
              onChange={e => setDraft(d => ({ ...d, actionText: e.target.value }))}
              placeholder={t('e.g. Learn more')}
            />
          </div>
          <div>
            <label className='block text-sm font-medium mb-1'>{t('Action Button URL')}</label>
            <Input
              value={draft.actionUrl}
              onChange={e => setDraft(d => ({ ...d, actionUrl: e.target.value }))}
              placeholder='https://... or /groups/...'
            />
            {actionHint && <p className='text-xs text-foreground/50 mt-1'>{actionHint}</p>}
          </div>
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
            ? <div className='text-foreground/50 p-4 border border-foreground/20 rounded-md'>{t('No banners yet.')}</div>
            : (
              <ul className='divide-y divide-foreground/10 border border-foreground/20 rounded-md'>
                {banners.map(banner => (
                  <li key={banner.id} className='p-4'>
                    <div className='flex items-start justify-between gap-4'>
                      <div className='min-w-0 flex-1'>
                        {banner.title && <p className='font-bold mb-1'>{banner.title}</p>}
                        <HyloHTML className='text-sm mb-1' html={banner.text} />
                        {banner.actionText && (
                          <p className='text-xs text-foreground/50 mb-1'>
                            {t('Button')}: {banner.actionText} &rarr; {banner.actionUrl}
                          </p>
                        )}
                        <p className='text-xs text-foreground/50'>
                          {statusLabel(banner)}
                          {banner.creator?.name && ` · ${t('by')} ${banner.creator.name}`}
                          {typeof banner.dismissedCount === 'number' && banner.publishedAt && ` · ${t('{{count}} dismissed', { count: banner.dismissedCount })}`}
                        </p>
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
