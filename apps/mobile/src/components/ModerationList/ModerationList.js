import React, { useCallback, useMemo, useEffect } from 'react'
import { View, FlatList, StyleSheet } from 'react-native'
import { useSelector, useDispatch } from 'react-redux'
import { createSelector } from 'reselect'
import { useIsFocused, useNavigation } from '@react-navigation/native'

import { fetchModerationActions, clearModerationAction } from 'store/actions/moderationActions'
import { getHasMoreModerationActions, getModerationActions } from 'store/selectors/getModerationActions'
import Loading from 'components/Loading'
import ModerationListItem from 'components/ModerationListItem'
import ListControl from 'components/ListControl'
import { DECISIONS_OPTIONS } from 'components/StreamList/StreamList'

export default function ModerationList ({ forGroup, header, scrollRef, streamType }) {
  const dispatch = useDispatch()
  const isFocused = useIsFocused()
  const navigation = useNavigation()
  const { navigate } = navigation

  const fetchModerationActionParam = useMemo(() => ({
    slug: forGroup?.slug,
    groupId: forGroup?.id
  }), [forGroup?.slug, forGroup?.id])

  const selectModerationActions = useMemo(
    () => createSelector(
      state => state,
      state => getModerationActions(state, fetchModerationActionParam)
    ),
    [fetchModerationActionParam]
  )

  const selectHasMoreModerationActions = useMemo(
    () => createSelector(
      state => state,
      state => getHasMoreModerationActions(state, fetchModerationActionParam)
    ),
    [fetchModerationActionParam]
  )

  const moderationActions = useSelector(selectModerationActions)
  const hasMoreModerationActions = useSelector(selectHasMoreModerationActions)
  const pending = useSelector(state => state.pending.FETCH_MODERATION_ACTIONS)

  const refreshModerationActions = useCallback(() => {
    if (fetchModerationActionParam) {
      dispatch(fetchModerationActions(fetchModerationActionParam, { reset: true }))
    }
  }, [fetchModerationActionParam, dispatch])

  const fetchMoreModerationActions = useCallback(() => {
    if (fetchModerationActionParam && hasMoreModerationActions && !pending) {
      dispatch(fetchModerationActions({
        ...fetchModerationActionParam,
        offset: moderationActions.length
      }))
    }
  }, [fetchModerationActionParam, hasMoreModerationActions, pending, moderationActions.length, dispatch])

  const handleClearModerationAction = useCallback(({ postId, moderationActionId, groupId }) => {
    dispatch(clearModerationAction({ postId, moderationActionId, groupId }))
  }, [dispatch])

  const renderModerationItem = useCallback(({ item }) => (
    <ModerationListItem
      moderationAction={item}
      handleClearModerationAction={handleClearModerationAction}
      group={forGroup}
    />
  ), [forGroup, handleClearModerationAction])

  useEffect(() => {
    if (isFocused && fetchModerationActionParam) {
      dispatch(fetchModerationActions(fetchModerationActionParam, { reset: true }))
    }
  }, [isFocused, fetchModerationActionParam, dispatch])

  if (!fetchModerationActionParam) return null
  return (
    <View style={styles.container}>
      <FlatList
        ref={scrollRef}
        data={moderationActions}
        renderItem={renderModerationItem}
        onRefresh={refreshModerationActions}
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
  },
})
