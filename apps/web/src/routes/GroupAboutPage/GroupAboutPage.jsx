import { Info } from 'lucide-react'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'

import GroupAboutView from 'components/GroupAboutView'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import fetchGroupDetails from 'store/actions/fetchGroupDetails'
import getGroupForSlug from 'store/selectors/getGroupForSlug'

/** Full-page About for the current group: banner, then the tabbed sections. */
export default function GroupAboutPage () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { groupSlug } = useRouteParams()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({ title: t('About'), icon: <Info />, search: false })
  }, [setHeaderDetails, t])

  useEffect(() => {
    if (!groupSlug) return
    dispatch(fetchGroupDetails({ slug: groupSlug, withContextWidgets: false, withWidgets: false, withPrerequisites: false }))
  }, [dispatch, groupSlug])

  if (!group) return <Loading />

  return (
    <div className='h-full overflow-y-auto'>
      <GroupAboutView group={group} />
    </div>
  )
}
