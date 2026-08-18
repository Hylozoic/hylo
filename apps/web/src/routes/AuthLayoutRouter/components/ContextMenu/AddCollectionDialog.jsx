import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { House } from 'lucide-react'

import Button from 'components/ui/button'
import { Input } from 'components/ui/input'
import LucideIconPicker from 'components/LucideIconPicker/LucideIconPicker'
import PostSelector from 'components/PostSelector'
import {
  addPostToView,
  createGroupView,
  fetchViewPosts,
  removePostFromView,
  reorderViewPost,
  setHomeView,
  updateGroupView
} from 'store/actions/groupViews'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import fetchForGroup from 'store/actions/fetchForGroup'

/** Resolves the group that owns a view (top-level menu or nested space menu). */
function findViewOwnerGroup (parentGroup, viewId) {
  const items = parentGroup?.groupViews?.items || []
  if (items.some(v => String(v.id) === String(viewId))) return parentGroup
  for (const menuView of items) {
    const spaceGroup = menuView.linkedGroup
    if (spaceGroup?.groupViews?.items?.some(v => String(v.id) === String(viewId))) {
      return spaceGroup
    }
  }
  return parentGroup
}

/** Modal for creating or editing a collection GroupView and its posts.
 * Pass `onAdd` to stage a new view locally instead of dispatching mutations (see AddGroupViewDialog).
 * Pass `view` to edit an existing collection. */
export default function AddCollectionDialog ({ group, view, onCancel, onCreated, onAdd }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const isEditing = Boolean(view?.id)
  const [name, setName] = useState(view?.name || '')
  const [icon, setIcon] = useState(view?.icon || 'Layers')
  const [posts, setPosts] = useState([])
  const [initialPostIds, setInitialPostIds] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingPosts, setIsLoadingPosts] = useState(isEditing)

  const ownerGroup = useMemo(
    () => (isEditing ? findViewOwnerGroup(group, view.id) : group),
    [group, isEditing, view?.id]
  )

  useEffect(() => {
    if (!isEditing) {
      setPosts([])
      setInitialPostIds([])
      setIsLoadingPosts(false)
      return
    }

    setName(view?.name || '')
    setIcon(view?.icon || 'Layers')

    let cancelled = false
    setIsLoadingPosts(true)

    const loadPosts = async () => {
      if (view.collectionPosts) {
        if (!cancelled) {
          setPosts(view.collectionPosts)
          setInitialPostIds(view.collectionPosts.map(p => String(p.id)))
        }
      }

      if (!ownerGroup?.id) {
        if (!cancelled) setIsLoadingPosts(false)
        return
      }

      try {
        const result = await dispatch(fetchViewPosts(ownerGroup.id, view.id))
        if (cancelled) return
        const items = result?.payload?.data?.group?.groupViews?.items || []
        const matched = items.find(v => String(v.id) === String(view.id))
        const loadedPosts = matched?.collectionPosts || view.collectionPosts || []
        setPosts(loadedPosts)
        setInitialPostIds(loadedPosts.map(p => String(p.id)))
      } catch (error) {
        console.error('Failed to load collection posts:', error)
      } finally {
        if (!cancelled) setIsLoadingPosts(false)
      }
    }

    loadPosts()
    return () => { cancelled = true }
  }, [dispatch, isEditing, ownerGroup?.id, view?.id, view?.name, view?.icon, view?.collectionPosts])

  const canSave = name.trim().length >= 2

  const handleSelectPost = useCallback((post) => {
    setPosts(prev => {
      if (prev.some(p => String(p.id) === String(post.id))) return prev
      return [...prev, post]
    })
  }, [])

  const handleRemovePost = useCallback((post) => {
    setPosts(prev => prev.filter(p => String(p.id) !== String(post.id)))
  }, [])

  const handleReorderPost = useCallback((post, newIndex) => {
    setPosts(prev => {
      const fromIndex = prev.findIndex(p => String(p.id) === String(post.id))
      if (fromIndex === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(newIndex, 0, moved)
      return next
    })
  }, [])

  /** Persist create or update for the collection view and its post membership. */
  const handleSave = useCallback(async () => {
    if (!canSave) return

    const viewData = {
      type: 'collection',
      name: name.trim(),
      icon,
      postIds: posts.map(p => p.id),
      addToEnd: true
    }

    if (onAdd && !isEditing) {
      onAdd(viewData)
      return
    }

    if (!group?.id) return
    setIsSaving(true)
    try {
      if (isEditing) {
        await dispatch(updateGroupView({
          id: view.id,
          groupId: group.id,
          name: viewData.name,
          icon
        }))

        const currentIds = posts.map(p => String(p.id))
        const menuGroupId = group.id

        for (const postId of initialPostIds) {
          if (!currentIds.includes(postId)) {
            await dispatch(removePostFromView({
              groupId: menuGroupId,
              viewId: view.id,
              postId
            }))
          }
        }

        for (const [index, post] of posts.entries()) {
          if (!initialPostIds.includes(String(post.id))) {
            await dispatch(addPostToView({
              groupId: menuGroupId,
              viewId: view.id,
              postId: post.id,
              order: index,
              post
            }))
          }
        }

        // Align final order after adds/removes (indices may have shifted)
        const orderChanged = posts.length !== initialPostIds.length ||
          posts.some((post, index) => initialPostIds[index] !== String(post.id))
        if (orderChanged) {
          for (const [index, post] of posts.entries()) {
            await dispatch(reorderViewPost({
              groupId: menuGroupId,
              viewId: view.id,
              postId: post.id,
              order: index
            }))
          }
        }
      } else {
        const result = await dispatch(createGroupView({
          groupId: group.id,
          type: 'collection',
          name: viewData.name,
          icon,
          addToEnd: true
        }))
        const viewId = result?.payload?.data?.createGroupView?.id
        if (viewId && posts.length > 0) {
          for (const post of posts) {
            await dispatch(addPostToView({
              groupId: group.id,
              viewId,
              postId: post.id,
              post
            }))
          }
        }
      }
      onCreated?.()
    } catch (error) {
      console.error(isEditing ? 'Failed to update collection view:' : 'Failed to create collection view:', error)
    } finally {
      setIsSaving(false)
    }
  }, [
    canSave,
    dispatch,
    group?.id,
    name,
    icon,
    posts,
    initialPostIds,
    isEditing,
    view?.id,
    onCreated,
    onAdd
  ])

  /** Set this collection as the group's home view (order = 0). */
  const handleSetHome = useCallback(async () => {
    if (!view?.id || !ownerGroup?.id) return
    if (!window.confirm(t('Set this view as the home view for the group?'))) return
    try {
      await dispatch(setHomeView({ viewId: view.id, groupId: ownerGroup.id }))
      await dispatch(fetchGroupViews(ownerGroup.id))
      if (ownerGroup.slug) await dispatch(fetchForGroup(ownerGroup.slug))
      onCancel?.()
    } catch (error) {
      console.error('Failed to set home view:', error)
    }
  }, [dispatch, view?.id, ownerGroup, onCancel, t])

  const postSelectorGroup = ownerGroup || group
  const canBeHome = isEditing && view?.order !== 0

  return (
    <div className='fixed inset-0 z-[1100] flex items-center justify-center bg-darkening/50 p-4 pointer-events-auto'>
      <div className='bg-midground rounded-lg shadow-lg p-5 w-full max-w-md max-h-[85vh] flex flex-col'>
        <h2 className='text-lg font-semibold mb-4'>{t('Collection')}</h2>

        <div className='overflow-y-auto flex-1 min-h-0 flex flex-col gap-3 p-1'>
          <div className='flex flex-col gap-1'>
            <label className='text-sm text-foreground/70'>{t('Name')}</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('Name')} />
          </div>

          <div className='flex flex-col gap-1'>
            <label className='text-sm text-foreground/70'>{t('Icon')}</label>
            <LucideIconPicker value={icon} onChange={setIcon} />
          </div>

          {postSelectorGroup && (
            <div className='flex flex-col gap-1'>
              <label className='text-sm text-foreground/70'>{t('Posts')}</label>
              <p className='text-xs text-foreground/50 mb-1'>
                <span>{posts.length}</span> <span>{t('posts in this collection')}</span>
              </p>
              {isLoadingPosts
                ? <p className='text-xs text-foreground/40'>{t('Loading…')}</p>
                : (
                  <PostSelector
                    group={postSelectorGroup}
                    viewId={view?.id}
                    posts={posts}
                    draggable
                    onSelectPost={handleSelectPost}
                    onRemovePost={handleRemovePost}
                    onReorderPost={handleReorderPost}
                  />
                  )}
            </div>
          )}
        </div>

        <div className='flex flex-wrap gap-2 mt-4 pt-2 border-t border-foreground/10'>
          <Button variant='primary' onClick={onCancel}>
            {isEditing ? t('Cancel') : t('Back')}
          </Button>
          {canBeHome && (
            <Button variant='secondary' onClick={handleSetHome} className='flex items-center gap-1'>
              <House className='w-4 h-4' />
              {t('Set as Home View')}
            </Button>
          )}
          <div className='flex-1' />
          <Button variant='secondary' disabled={!canSave || isSaving || isLoadingPosts} onClick={handleSave}>
            {isSaving
              ? (isEditing ? t('Saving...') : t('Creating...'))
              : (isEditing ? t('Save') : t('Add View'))}
          </Button>
        </div>
      </div>
    </div>
  )
}
