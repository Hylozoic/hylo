import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Pencil, Plus } from 'lucide-react'

import Avatar from 'components/Avatar'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import SwitchStyled from 'components/SwitchStyled'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { addQuerystringToPath, groupUrl, localSpaceSlug } from '@hylo/navigation'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { createGroupView, setGroupViewHidden } from 'store/actions/groupViews'
import { getGroupViews } from 'store/selectors/getGroupViews'
import { getEditMenuOffMenuSections } from 'store/selectors/getMoreSpacesSections'
import { updateGroupSettings } from 'routes/GroupSettings/GroupSettings.store'
import { FETCH_GROUP_SPACES } from 'store/constants'
import isPendingFor from 'store/selectors/isPendingFor'

import AddGroupViewDialog, { AddViewButton } from './AddGroupViewDialog'
import AddSpaceDialog, { AddSpaceButton } from './AddSpaceDialog'

/** Section heading for Edit Menu off-menu lists. */
function SectionHeading ({ children }) {
  return (
    <h3 className='text-xs text-foreground/40 uppercase tracking-wide mt-6 mb-2'>
      {children}
    </h3>
  )
}

/** Icon for an off-menu space row. */
function SpaceIcon ({ space }) {
  if (space.avatarUrl) {
    return <Avatar avatarUrl={space.avatarUrl} name={space.name} small />
  }
  if (space.icon) {
    return <LucideIcon name={space.icon} className='h-5 w-5 shrink-0' />
  }
  return <div className='h-5 w-5 shrink-0 rounded-full bg-foreground/15' />
}

/**
 * Off-menu space row: click opens space in the sidebar (edit mode),
 * hover shows plus to add the space to the parent menu.
 */
function OffMenuSpaceRow ({ space, onOpen, onAddToMenu }) {
  const { t } = useTranslation()

  return (
    <div className='group flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-transparent hover:border-foreground/30 hover:bg-card transition-all'>
      <button
        type='button'
        onClick={() => onOpen(space)}
        className='flex-1 flex items-center gap-3 min-w-0 text-left'
      >
        <SpaceIcon space={space} />
        <span className='truncate font-medium text-foreground'>{space.name}</span>
      </button>
      {onAddToMenu && (
        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation()
            onAddToMenu(space)
          }}
          className='p-1.5 text-foreground/50 hover:text-foreground rounded opacity-0 group-hover:opacity-100 shrink-0 transition-opacity'
          aria-label={t('Add to Menu')}
          title={t('Add to Menu')}
        >
          <Plus className='w-4 h-4' />
        </button>
      )}
    </div>
  )
}

/**
 * Full-page Edit Menu for independent space mode: add view/space,
 * welcome toggles, and draft/archived off-menu spaces.
 */
export default function EditMenuPage ({ group }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { setHeaderDetails } = useViewHeader()
  const groupSlug = group?.slug

  const groupViews = useSelector(state => getGroupViews(state, group))
  const sections = useSelector(state => getEditMenuOffMenuSections(state, group))
  const pending = useSelector(state => isPendingFor([FETCH_GROUP_SPACES], state))

  const welcomeView = useMemo(
    () => (groupViews || []).find(v => v.type === 'welcome') || null,
    [groupViews]
  )
  const showInMenu = welcomeView?.order != null
  const showWelcomePage = group?.settings?.showWelcomePage ?? true

  const [showAddView, setShowAddView] = useState(false)
  const [showAddSpace, setShowAddSpace] = useState(false)
  const [welcomeBusy, setWelcomeBusy] = useState(false)

  useEffect(() => {
    setHeaderDetails({
      title: t('Edit Menu'),
      icon: '',
      info: '',
      search: false
    })
  }, [setHeaderDetails, t])

  useEffect(() => {
    if (!group?.id) return
    dispatch(fetchGroupViews(group.id))
    dispatch(fetchGroupSpaces(group.id))
  }, [dispatch, group?.id])

  /** Ensures a welcome GroupView exists. Pass inMenu to add it to the menu order. */
  const ensureWelcomeView = useCallback(async ({ inMenu = false } = {}) => {
    if (welcomeView?.id) return welcomeView
    const result = await dispatch(createGroupView({
      groupId: group.id,
      type: 'welcome',
      ...(inMenu ? { addToEnd: true } : {})
    }))
    await dispatch(fetchGroupViews(group.id))
    return result?.payload?.data?.createGroupView || null
  }, [dispatch, group?.id, welcomeView])

  const handleToggleShowWelcomePage = useCallback(async () => {
    if (!group?.id || welcomeBusy) return
    setWelcomeBusy(true)
    try {
      const next = !showWelcomePage
      if (next && !welcomeView) {
        await ensureWelcomeView({ inMenu: false })
      }
      await dispatch(updateGroupSettings(group.id, { settings: { showWelcomePage: next } }))
    } catch (error) {
      console.error('Failed to toggle show welcome page:', error)
    } finally {
      setWelcomeBusy(false)
    }
  }, [group?.id, welcomeBusy, showWelcomePage, welcomeView, ensureWelcomeView, dispatch])

  const handleToggleShowInMenu = useCallback(async () => {
    if (!group?.id || welcomeBusy) return
    if (welcomeView?.order === 0) return
    setWelcomeBusy(true)
    try {
      const wantShown = !showInMenu
      if (!welcomeView) {
        if (wantShown) await ensureWelcomeView({ inMenu: true })
        return
      }
      await dispatch(setGroupViewHidden({
        id: welcomeView.id,
        groupId: group.id,
        hidden: !wantShown
      }))
      await dispatch(fetchGroupViews(group.id))
    } catch (error) {
      console.error('Failed to toggle welcome show in menu:', error)
    } finally {
      setWelcomeBusy(false)
    }
  }, [group?.id, welcomeBusy, welcomeView, showInMenu, ensureWelcomeView, dispatch])

  const handleAddSpaceToMenu = useCallback(async (space) => {
    if (!group?.id || !space?.id) return
    try {
      await dispatch(createGroupView({
        groupId: group.id,
        type: 'space',
        linkedGroupId: space.id,
        addToEnd: true
      }))
      await dispatch(fetchGroupViews(group.id))
      await dispatch(fetchGroupSpaces(group.id))
    } catch (error) {
      console.error('Failed to add space to menu:', error)
    }
  }, [dispatch, group?.id])

  /** Open space views in the ContextMenu while staying on Edit Menu. */
  const handleOpenSpace = useCallback((space) => {
    const local = localSpaceSlug(groupSlug, space.slug)
    navigate(addQuerystringToPath(groupUrl(groupSlug, 'edit-menu'), {
      edit: 'true',
      space: local
    }))
  }, [navigate, groupSlug])

  /** Exit edit mode and return to the group home. */
  const handleDoneEditing = useCallback(() => {
    navigate(groupUrl(groupSlug))
  }, [navigate, groupSlug])

  const handleAddViewClose = useCallback(async () => {
    setShowAddView(false)
    if (group?.id) await dispatch(fetchGroupViews(group.id))
  }, [dispatch, group?.id])

  const handleAddSpaceClose = useCallback(async () => {
    setShowAddSpace(false)
    if (group?.id) {
      await dispatch(fetchGroupViews(group.id))
      await dispatch(fetchGroupSpaces(group.id))
    }
  }, [dispatch, group?.id])

  const sectionBlocks = [
    { key: 'draftTracks', title: t('Draft Tracks'), spaces: sections.draftTracks, canAdd: true },
    { key: 'archivedTracks', title: t('Archived Tracks'), spaces: sections.archivedTracks, canAdd: true },
    { key: 'draftFundingRounds', title: t('Draft Funding Rounds'), spaces: sections.draftFundingRounds, canAdd: true },
    { key: 'archivedFundingRounds', title: t('Archived Funding Rounds'), spaces: sections.archivedFundingRounds, canAdd: true },
    { key: 'otherArchivedSpaces', title: t('Other Archived Spaces'), spaces: sections.otherArchivedSpaces, canAdd: true }
  ].filter(block => block.spaces.length > 0)

  return (
    <div className='w-full max-w-[720px] mx-auto px-4 py-6'>
      <p className='text-sm text-foreground/70 mb-6'>
        {t('Drag and drop items in the menu on the left to reorder them. The top item is the home view for this group.')}
      </p>

      <div className='flex flex-wrap gap-2 mb-8'>
        <AddViewButton onClick={() => setShowAddView(true)} />
        <AddSpaceButton onClick={() => setShowAddSpace(true)} />
      </div>

      <section className='mb-8'>
        <h2 className='text-lg font-semibold text-foreground mb-3'>{t('Welcome Page')}</h2>
        <div className='flex flex-col gap-3 rounded-lg border border-foreground/15 p-4 bg-card/40'>
          <div className='flex items-center gap-3'>
            <SwitchStyled
              checked={showWelcomePage}
              onChange={handleToggleShowWelcomePage}
              backgroundColor={showWelcomePage ? 'hsl(var(--selected))' : 'rgba(0 0 0 / .6)'}
              disabled={welcomeBusy}
            />
            <span className='text-sm text-foreground/80'>
              {t('Show Welcome Page to users')}
            </span>
          </div>
          <div className='flex items-center gap-3'>
            <SwitchStyled
              checked={showInMenu}
              onChange={handleToggleShowInMenu}
              backgroundColor={showInMenu ? 'hsl(var(--selected))' : 'rgba(0 0 0 / .6)'}
              disabled={welcomeBusy || welcomeView?.order === 0}
            />
            <span className='text-sm text-foreground/80'>
              {welcomeView?.order === 0
                ? t('This is the home view, so it always appears in the menu. Set another view as home to hide it.')
                : t('Show in the Menu')}
            </span>
          </div>
          {welcomeView && welcomeView.order == null && (
            <p className='text-xs text-foreground/50'>
              {t('Welcome page exists but is hidden from the menu.')}
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className='text-lg font-semibold text-foreground mb-1'>{t('Spaces not in menu')}</h2>
        <p className='text-sm text-foreground/50 mb-4'>
          {t('Add a space to the menu with +, or open it to edit its views.')}
        </p>
        {pending && !sections.hasAny
          ? <p className='text-sm text-foreground/40'>{t('Loading…')}</p>
          : !sections.hasAny
              ? <p className='text-sm text-foreground/40'>{t('No draft or archived spaces off the menu')}</p>
              : sectionBlocks.map(block => (
                <div key={block.key}>
                  <SectionHeading>{block.title}</SectionHeading>
                  {block.spaces.map(space => (
                    <OffMenuSpaceRow
                      key={space.id}
                      space={space}
                      onOpen={handleOpenSpace}
                      onAddToMenu={block.canAdd ? handleAddSpaceToMenu : null}
                    />
                  ))}
                </div>
              ))}
      </section>

      <div className='sticky bottom-0 mt-8 pt-6 pb-2 bg-midground'>
        <button
          type='button'
          onClick={handleDoneEditing}
          className='flex items-center justify-center gap-2 w-full text-base font-medium text-foreground border-2 border-foreground/30 hover:border-foreground/50 hover:bg-card rounded-md px-3 py-2.5 transition-all'
        >
          <Pencil className='w-4 h-4' />
          <span>{t('Done Editing')}</span>
        </button>
      </div>

      {showAddView && (
        <AddGroupViewDialog
          group={group}
          groupViews={groupViews}
          acceptedPostTypes={group?.acceptedPostTypes}
          onClose={handleAddViewClose}
        />
      )}
      {showAddSpace && (
        <AddSpaceDialog group={group} onClose={handleAddSpaceClose} />
      )}
    </div>
  )
}
