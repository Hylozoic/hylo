import React, { useRef, useEffect } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native'
import { capitalize, isEmpty } from 'lodash/fp'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import { useTranslation } from 'react-i18next'
import { PUBLIC_GROUP_ID } from '@hylo/presenters/GroupPresenter'
import useRouteParams from 'hooks/useRouteParams'
import CreateGroupNotice from 'components/CreateGroupNotice'
import GroupWelcomeCheck from 'components/GroupWelcomeCheck'
import Loading from 'components/Loading'
import ModerationList from 'components/ModerationList'
import StreamHeader from './StreamHeader'
import StreamList from 'components/StreamList'

export default function Stream () {
  const ref = useRef(null)
  const { t } = useTranslation()
  const navigation = useNavigation()
  const route = useRoute()
  const { customViewId, streamType, myHome } = useRouteParams()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup }] = useCurrentGroup()

  const customView = currentGroup?.customViews?.items?.find(view => view.id === customViewId)
  const customPostTypes = customView?.type === 'stream' ? customView?.postTypes : null

  useEffect(() => {
    navigation.setOptions({
      title: myHome || streamType === 'Moderation'
        ? t('Moderation')
        : streamType
          ? capitalize(t(streamType) + 's')
          : currentGroup?.name
    })
  }, [navigation, currentGroup?.id, streamType, myHome])

  if (!currentUser) return <Loading style={{ flex: 1 }} />
  if (!currentGroup) return null

  const name = currentGroup.name
  const image = currentGroup.bannerUrl ? { uri: currentGroup.bannerUrl } : null

  if (isEmpty(currentUser?.memberships) && currentGroup?.id !== PUBLIC_GROUP_ID) {
    return <CreateGroupNotice />
  }

  return (
    <>
      <GroupWelcomeCheck />
      {streamType !== 'moderation'
        ? (
          <StreamList
            scrollRef={ref}
            forGroup={currentGroup}
            header={(
              <StreamHeader
                image={image}
                icon={customView?.icon}
                name={customView?.name || myHome || name}
                currentGroup={currentGroup}
                streamType={streamType}
                customView={customView}
                postPrompt
              />
            )}
            route={route}
            streamType={streamType}
            myHome={myHome}
            customPostTypes={customPostTypes}
          />
          )
        : (
          <ModerationList
            scrollRef={ref}
            forGroup={currentGroup}
            header={(
              <StreamHeader
                image={image}
                icon={customView?.icon}
                name={customView?.name || myHome || name}
              />
            )}
            route={route}
            streamType={streamType}
          />
          )}
    </>
  )
}
