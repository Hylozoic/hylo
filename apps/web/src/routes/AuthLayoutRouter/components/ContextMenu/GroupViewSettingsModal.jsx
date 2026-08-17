import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { House, Trash2, X } from 'lucide-react'

import Button from 'components/ui/button'
import { Input } from 'components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'
import CustomViewFormFields from 'components/CustomViewForm/CustomViewFormFields'
import {
  CUSTOM_VIEW_DEFAULT_POST_TYPES,
  CUSTOM_VIEW_DEFAULT_VIEW_MODE
} from 'components/CustomViewForm/customViewFormConstants'
import HyloEditor from 'components/HyloEditor'
import LucideIconPicker from 'components/LucideIconPicker/LucideIconPicker'
import SwitchStyled from 'components/SwitchStyled'
import GroupViewIcon from './GroupViewIcon'
import { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import { setHomeView, updateGroupView } from 'store/actions/groupViews'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import fetchForGroup from 'store/actions/fetchForGroup'
import { updateGroupSettings } from 'routes/GroupSettings/GroupSettings.store'
import { canDeleteView, canHardDeleteView, canSetAsHomeView, isSoftRemoveView, viewTypeHasSettings } from 'store/models/GroupView'
import { cn } from 'util/index'
import { sanitizeURL } from 'util/url'

/** Build initial custom view form state from a GroupView record. */
function customViewFormState (view) {
  const settings = view?.settings || {}
  return {
    name: view?.name || '',
    icon: view?.icon || 'ListFilter',
    postTypes: settings.postTypes?.length ? settings.postTypes : CUSTOM_VIEW_DEFAULT_POST_TYPES,
    topics: (view?.topics || []).map(name => ({ name })),
    searchText: settings.searchText || '',
    defaultViewMode: settings.defaultViewMode || CUSTOM_VIEW_DEFAULT_VIEW_MODE
  }
}

/** Text for a text view — prefer pageContent, fall back to legacy name from widget migration. */
function textContentFromView (view) {
  return view?.pageContent || view?.name || ''
}

/** Settings modal for editing a single GroupView row. */
export default function GroupViewSettingsModal ({ view, group, onClose }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const welcomeEditorRef = useRef()
  const [name, setName] = useState(view?.name || '')
  const [link, setLink] = useState(view?.link || '')
  const [linkIcon, setLinkIcon] = useState(view?.icon || 'Globe')
  const [textContent, setTextContent] = useState(() => textContentFromView(view))
  const [showWelcomePage, setShowWelcomePage] = useState(group?.settings?.showWelcomePage ?? true)
  const [showPostNoticesInChat, setShowPostNoticesInChat] = useState(group?.settings?.showPostNoticesInChat ?? true)
  const [showChatActivity, setShowChatActivity] = useState(view?.settings?.showChatActivity !== false)
  const [customForm, setCustomForm] = useState(() => customViewFormState(view))
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setName(view?.name || '')
    setLink(view?.link || '')
    setLinkIcon(view?.icon || 'Globe')
    setTextContent(textContentFromView(view))
    setShowWelcomePage(group?.settings?.showWelcomePage ?? true)
    setShowPostNoticesInChat(group?.settings?.showPostNoticesInChat ?? true)
    setShowChatActivity(view?.settings?.showChatActivity !== false)
    setCustomForm(customViewFormState(view))
  }, [
    view?.id,
    view?.name,
    view?.link,
    view?.icon,
    view?.pageContent,
    view?.order,
    view?.topics,
    view?.settings,
    group?.settings?.showWelcomePage,
    group?.settings?.showPostNoticesInChat
  ])

  const updateCustomForm = useCallback((key, value) => {
    setCustomForm(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!view?.id || !group?.id) return
    setIsSaving(true)
    try {
      if (view.type === 'welcome') {
        const pageContent = welcomeEditorRef.current?.getHTML?.() ?? view.pageContent
        await dispatch(updateGroupView({
          id: view.id,
          groupId: group.id,
          pageContent
        }))
        if (showWelcomePage !== (group.settings?.showWelcomePage ?? true)) {
          await dispatch(updateGroupSettings(group.id, { settings: { showWelcomePage } }))
        }
      } else if (view.type === 'chat') {
        if (showPostNoticesInChat !== (group.settings?.showPostNoticesInChat ?? true)) {
          await dispatch(updateGroupSettings(group.id, { settings: { showPostNoticesInChat } }))
        }
      } else if (view.type === 'all') {
        await dispatch(updateGroupView({
          id: view.id,
          groupId: group.id,
          settings: {
            ...(view.settings || {}),
            showChatActivity
          }
        }))
      } else if (view.type === 'link') {
        const trimmedLink = link.trim()
        await dispatch(updateGroupView({
          id: view.id,
          groupId: group.id,
          name: name.trim() || null,
          link: trimmedLink ? (sanitizeURL(trimmedLink) || trimmedLink) : null,
          icon: linkIcon
        }))
      } else if (view.type === 'text') {
        const trimmed = textContent.trim() || null
        // Clear legacy name so migrated text views store content only in pageContent
        await dispatch(updateGroupView({
          id: view.id,
          groupId: group.id,
          pageContent: trimmed,
          name: null
        }))
      } else if (view.type === 'custom') {
        await dispatch(updateGroupView({
          id: view.id,
          groupId: group.id,
          name: customForm.name.trim(),
          icon: customForm.icon,
          topics: customForm.topics.map(topic => topic.name),
          settings: {
            ...(view.settings || {}),
            postTypes: customForm.postTypes,
            defaultViewMode: customForm.defaultViewMode,
            defaultSort: view.settings?.defaultSort || 'created',
            activePostsOnly: view.settings?.activePostsOnly ?? false,
            searchText: customForm.searchText.trim() || undefined
          }
        }))
      } else if (name !== view.name) {
        await dispatch(updateGroupView({
          id: view.id,
          groupId: group.id,
          name: name || null
        }))
      }
      onClose()
    } catch (error) {
      console.error('Failed to save view settings:', error)
    } finally {
      setIsSaving(false)
    }
  }, [
    customForm,
    dispatch,
    view,
    group,
    name,
    link,
    linkIcon,
    textContent,
    showWelcomePage,
    showPostNoticesInChat,
    showChatActivity,
    onClose
  ])

  const handleSetHome = useCallback(async () => {
    if (!view?.id || !group?.id) return
    if (!window.confirm(t('Set this view as the home view for the group?'))) return
    try {
      await dispatch(setHomeView({ viewId: view.id, groupId: group.id }))
      await dispatch(fetchGroupViews(group.id))
      await dispatch(fetchForGroup(group.slug))
      onClose()
    } catch (error) {
      console.error('Failed to set home view:', error)
    }
  }, [dispatch, view?.id, group, onClose, t])

  const spaceGroupForLabel = useMemo(() => {
    if (!view || !['funding-round-submissions', 'track-actions'].includes(view.type)) return null
    if (group?.fundingRound || group?.track) return group
    return (group?.groupViews?.items || [])
      .map(menuView => menuView.linkedGroup)
      .find(linked => linked?.groupViews?.items?.some(spaceView => String(spaceView.id) === String(view.id))) || null
  }, [view, group])

  if (!view) return null

  const title = view.type === 'text'
    ? t('Edit Text View')
    : displayNameForView(view, t, { spaceGroup: spaceGroupForLabel })
  const canBeHome = canSetAsHomeView(view)
  const canSaveCustom = customForm.name.trim().length >= 2 && customForm.postTypes.length > 0
  const saveDisabled = view.type === 'custom' ? !canSaveCustom : isSaving

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-darkening/50'>
      <div className='bg-midground rounded-lg shadow-lg p-4 w-full max-w-lg max-h-[85vh] overflow-y-auto'>
        <h2 className='text-lg font-semibold mb-4 flex items-center gap-2'>
          <GroupViewIcon view={view} />
          {title}
        </h2>

        <div className='flex flex-col gap-3'>
          {view.type === 'welcome' && (
            <>
              <div className='flex items-center gap-2'>
                <SwitchStyled
                  checked={showWelcomePage}
                  onChange={() => setShowWelcomePage(v => !v)}
                  backgroundColor={showWelcomePage ? 'hsl(var(--selected))' : 'rgba(0 0 0 / .6)'}
                />
                <span className='text-sm text-foreground/80'>
                  {t('Show this welcome page to new members when they first land in the group.')}
                </span>
              </div>
              <HyloEditor
                key={view.id}
                contentHTML={view.pageContent || ''}
                className='min-h-32 p-2 border border-foreground/20 rounded-lg bg-input'
                extendedMenu
                groupIds={[group.id]}
                ref={welcomeEditorRef}
                showMenu
                type='welcomePage'
              />
            </>
          )}

          {view.type === 'chat' && (
            <div className='flex items-center gap-2'>
              <SwitchStyled
                checked={showPostNoticesInChat}
                onChange={() => setShowPostNoticesInChat(v => !v)}
                backgroundColor={showPostNoticesInChat ? 'hsl(var(--selected))' : 'rgba(0 0 0 / .6)'}
              />
              <span className='text-sm text-foreground/80'>
                {t('Show post notices in chat when other post types are created in this group.')}
              </span>
            </div>
          )}

          {view.type === 'all' && (
            <div className='flex items-center gap-2'>
              <SwitchStyled
                checked={showChatActivity}
                onChange={() => setShowChatActivity(v => !v)}
                backgroundColor={showChatActivity ? 'hsl(var(--selected))' : 'rgba(0 0 0 / .6)'}
              />
              <span className='text-sm text-foreground/80'>
                {t('Show chat activity in All Activity')}
              </span>
            </div>
          )}

          {view.type === 'link' && (
            <>
              <div className='flex flex-col gap-1'>
                <label className='text-sm text-foreground/70'>{t('Icon')}</label>
                <LucideIconPicker value={linkIcon} onChange={setLinkIcon} />
              </div>
              <label className='text-sm text-foreground/70'>{t('Title')}</label>
              <Input value={name} onChange={e => setName(e.target.value)} />
              <label className='text-sm text-foreground/70'>{t('URL')}</label>
              <Input value={link} onChange={e => setLink(e.target.value)} />
            </>
          )}

          {view.type === 'text' && (
            <>
              <label className='text-sm text-foreground/70'>{t('Text to display in the menu')}</label>
              <textarea
                value={textContent}
                onChange={e => setTextContent(e.target.value)}
                rows={3}
                className='w-full rounded-md border border-foreground/20 bg-input p-2 text-sm text-foreground'
              />
            </>
          )}

          {view.type === 'custom' && (
            <CustomViewFormFields
              group={group}
              name={customForm.name}
              onNameChange={value => updateCustomForm('name', value)}
              icon={customForm.icon}
              onIconChange={value => updateCustomForm('icon', value)}
              postTypes={customForm.postTypes}
              onPostTypesChange={value => updateCustomForm('postTypes', value)}
              topics={customForm.topics}
              onTopicsChange={value => updateCustomForm('topics', value)}
              searchText={customForm.searchText}
              onSearchTextChange={value => updateCustomForm('searchText', value)}
              defaultViewMode={customForm.defaultViewMode}
              onDefaultViewModeChange={value => updateCustomForm('defaultViewMode', value)}
            />
          )}
        </div>

        <div className='flex flex-wrap gap-2 mt-4 pt-4 border-t border-foreground/10'>
          <Button variant='primary' onClick={onClose}>{t('Cancel')}</Button>
          {canBeHome && (
            <Button variant='secondary' onClick={handleSetHome} className='flex items-center gap-1'>
              <House className='w-4 h-4' />
              {t('Set as Home View')}
            </Button>
          )}
          <div className='flex-1' />
          <Button variant='secondary' disabled={saveDisabled} onClick={handleSave}>
            {isSaving ? t('Saving...') : t('Save')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Inline gear / remove controls shown on hover in edit mode.
 * X moves soft-removable views to More Views; trash permanently deletes when allowed. */
export function GroupViewEditActions ({ view, onSettings, onHide, onDelete, className }) {
  const { t } = useTranslation()
  const removable = canDeleteView(view)
  const hardDeletable = canHardDeleteView(view)
  const softRemovable = removable && isSoftRemoveView(view)
  const showSettings = viewTypeHasSettings(view?.type)
  // Same tooltip treatment as the card toolbars (CardEditActions): shared Tooltip
  // components instead of the native title delay, and Delete reads red before you
  // reach it — label red rather than the surface, since TooltipArrow is fixed to
  // fill-popover and a recoloured background would leave the arrow behind.
  return (
    <div className={cn('flex items-center gap-1 shrink-0', className)}>
      {showSettings && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              className='p-1 text-foreground/50 hover:text-foreground rounded'
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSettings(view) }}
              aria-label={t('Settings')}
            >
              <SettingsIcon />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('Settings')}</TooltipContent>
        </Tooltip>
      )}
      {softRemovable && onHide && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              className='p-1 text-foreground/50 hover:text-destructive rounded'
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onHide(view) }}
              aria-label={t('Remove from main menu')}
            >
              <X className='w-4 h-4' />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('Remove from main menu')}</TooltipContent>
        </Tooltip>
      )}
      {hardDeletable && onDelete && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              className='p-1 text-destructive hover:text-destructive rounded'
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(view) }}
              aria-label={view?.type === 'space' ? t('Delete Space') : t('Delete')}
            >
              <Trash2 className='w-4 h-4' />
            </button>
          </TooltipTrigger>
          <TooltipContent className='text-destructive font-semibold'>{view?.type === 'space' ? t('Delete Space') : t('Delete')}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

function SettingsIcon () {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' />
      <circle cx='12' cy='12' r='3' />
    </svg>
  )
}
