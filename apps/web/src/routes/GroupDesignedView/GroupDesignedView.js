import React, { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Pencil } from 'lucide-react'
import { groupUrl } from '@hylo/navigation'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import DesignedView from 'components/DesignedView'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import useGroupViews from 'hooks/useGroupViews'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getResponsibilitiesForGroup from 'store/selectors/getResponsibilitiesForGroup'
import { RESP_ADMINISTRATION } from 'store/constants'

/** Shows a designed view (GroupView type 'designed') to the group's members. */
export default function GroupDesignedView () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const { viewId } = useParams()
  const groupSlug = useEffectiveGroupSlug()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const groupViews = useGroupViews(group)
  const groupId = group?.id
  const groupViewsLoaded = group?.groupViews != null
  const currentUser = useSelector(getMe)
  const responsibilities = useSelector(state => getResponsibilitiesForGroup(state, { person: currentUser, groupId }))
  const canEdit = (responsibilities || []).some(responsibility => responsibility.title === RESP_ADMINISTRATION)

  const view = useMemo(
    () => groupViews.find(candidate => candidate.type === 'designed' && String(candidate.id) === String(viewId)),
    [groupViews, viewId]
  )
  const presented = useMemo(() => view ? GroupViewPresenter(view) : null, [view])
  const title = presented ? displayNameForView(presented, t) : t('Page')
  const headerIcon = presented?.lucideIcon || 'LayoutTemplate'
  const { setHeaderDetails } = useViewHeader()

  useEffect(() => {
    if (groupId && !groupViewsLoaded) dispatch(fetchGroupViews(groupId))
  }, [dispatch, groupId, groupViewsLoaded])

  useEffect(() => {
    setHeaderDetails({ title, icon: headerIcon, search: true })
  }, [setHeaderDetails, title, headerIcon])

  if (!group || !groupViewsLoaded) return <Loading />
  if (!view) return <p className='p-4 text-foreground/60'>{t('This page could not be found')}</p>

  return (
    <div className='w-full'>
      {canEdit && (
        <div className='flex justify-end px-4 pt-3'>
          <Link
            to={groupUrl(groupSlug, `design/${view.id}`)}
            className='inline-flex items-center gap-1 rounded-md border-2 border-foreground/20 hover:border-foreground/50 px-2 py-1 text-xs text-foreground hover:text-foreground no-underline'
            data-testid='designed-view-edit'
          >
            <Pencil className='w-3.5 h-3.5' />{t('Edit design')}
          </Link>
        </div>
      )}
      <DesignedView design={view.settings?.design} groupSlug={groupSlug} />
    </div>
  )
}
