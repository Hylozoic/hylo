import React, { useCallback, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useNavigation } from '@react-navigation/native'
import { gql, useMutation, useQuery } from 'urql'
import { DECISIONS_OPTIONS } from 'screens/Stream/Stream'
import Loading from 'components/Loading'
import ModerationListItem from 'components/ModerationListItem'
import ListControl from 'components/ListControl'

export const clearModerationActionMutation = gql`
  mutation ClearModerationActionMutation ( $postId: ID, $moderationActionId: ID, $groupId: ID ) {
    clearModerationAction ( postId: $postId, moderationActionId: $moderationActionId, groupId: $groupId ) {
      success
    }
  }
`
export const moderationActionsQuery = gql`
  query ModerationActionsQuery ($slug: String, $offset: Int, $sortBy: String, $first: Int = 20) {
    moderationActions (slug: $slug, offset: $offset, sortBy: $sortBy, first: $first) {
      hasMore
      items {
        __typename
        id
        postId
        groupId
        status
        post {
          id
          title
          details
          type
          creator {
            id
            name
            avatarUrl
          }
          groups { 
            id
          }
        }
        text
        reporter {
          id
          name
          avatarUrl
        }
        anonymous
        agreements {
          id
          description
          order
          title
        }
        platformAgreements {
          id
        }
      }
    }
  }
`

export default function ModerationList ({ forGroup, header, scrollRef, streamType }) {
  const navigation = useNavigation()
  const { navigate } = navigation
  const [offset, setOffset] = useState(0)
  const [, clearModerationAction] = useMutation(clearModerationActionMutation)
  const [{ data, pending }] = useQuery({
    query: moderationActionsQuery,
    variables: {
      slug: forGroup?.slug,
      offset
    }
  })

  const moderationActions = data?.moderationActions?.items
  const hasMore = data?.moderationActions?.hasMore

  const handleClearModerationAction = useCallback(({ postId, moderationActionId, groupId }) => {
    clearModerationAction({ postId, moderationActionId, groupId })
  }, [])

  const renderModerationItem = useCallback(({ item }) => (
    <ModerationListItem
      moderationAction={item}
      handleClearModerationAction={handleClearModerationAction}
      group={forGroup}
    />
  ), [forGroup, handleClearModerationAction])

  const handleRefresh = () => setOffset(0)

  const fetchMoreModerationActions = useCallback(() => {
    if (moderationActions && hasMore && !pending) {
      setOffset(moderationActions?.length)
    }
  }, [hasMore, pending])

  return (
    <View style={styles.container}>
      <FlashList
        ref={scrollRef}
        data={moderationActions || []}
        estimatedItemSize={365}
        renderItem={renderModerationItem}
        onRefresh={handleRefresh}
        refreshing={!!pending}
        keyExtractor={item => `moderation-action-${item.id}`}
        onEndReached={fetchMoreModerationActions}
        ListHeaderComponent={(
          <View>
            {header}
            <View style={[styles.listControls]}>
              <ListControl selected={streamType} onChange={() => navigate('Decisions')} options={DECISIONS_OPTIONS} />
            </View>
          </View>
        )}
        ListFooterComponent={pending ? <Loading style={styles.loading} /> : null}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white'
  },
  loading: {
    marginVertical: 20
  },
  listControls: {
    paddingTop: 4,
    paddingBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginRight: 6,
    marginLeft: 6
  }
})
