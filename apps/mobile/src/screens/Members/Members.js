import React from 'react'
import { get, pick, omit } from 'lodash/fp'
import { View, Text } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import FastImage from 'react-native-fast-image'
import LinearGradient from 'react-native-linear-gradient'
import Button from 'components/Button'
import MemberList from 'components/MemberList'
import { bannerlinearGradientColors } from 'style/colors'
import styles from './Members.styles'
import useCurrentGroup from 'hooks/useCurrentGroup'
import useHasResponsibility from 'hooks/useHasResponsibility'
import { RESP_ADD_MEMBERS } from 'store/constants'
import {
  FETCH_MEMBERS,
  fetchMembers as fetchMembersAction,
  getHasMoreMembers,
  getMembers,
  getSearch,
  getSort,
  setSearch as setSearchAction,
  setSort as setSortAction
} from './Members.store'

export function makeFetchOpts (props) {
  const { group, sortBy } = props

  return {
    ...omit(['group', 'sortBy'], props),
    sortBy: sortBy,
    slug: get('slug', group)
  }
}

// these keys must match the values that hylo-node can handle
export function sortKeysFactory () {
  const sortKeys = {
    name: 'Name',
    location: 'Location',
    join: 'Newest'
  }

  return sortKeys
}

export default function Members ({ isFocused }) {
  const navigation = useNavigation()
  const dispatch = useDispatch()
  const [group] = useCurrentGroup()
  const hasResponsibility = useHasResponsibility(group?.id)
  const canInvite = hasResponsibility(RESP_ADD_MEMBERS)
  const search = useSelector(getSearch)
  const selectedSortBy = useSelector(getSort)
  const fetchOpts = makeFetchOpts({ group, search, sortBy: selectedSortBy })
  // Use the sortBy that has been adjusted in the case of networks (see makeFetchOpts)
  const { slug, sortBy } = fetchOpts
  // TODO: URQL - convert to URQL queries
  const members = useSelector(state => getMembers(state, fetchOpts))
  const hasMore = useSelector(state => getHasMoreMembers(state, fetchOpts))
  const pending = useSelector(state => state.pending[FETCH_MEMBERS])
  const sortKeys = sortKeysFactory()

  const showMember = id => navigation.navigate('Member', { id })
  const setSort = sort => dispatch(setSortAction(sort))
  const setSearch = search => dispatch(setSearchAction(search))

  const fetchMembers = group
    ? () => dispatch(fetchMembersAction(fetchOpts))
    : () => {}
  const offset = members.length
  const fetchMoreMembers = hasMore && !pending
    ? () => dispatch(fetchMembersAction({ ...fetchOpts, offset }))
    : () => {}

  const goToInvitePeople = () => navigation.navigate('Group Settings', { screen: 'Invite' })
  const showInviteButton = get('allowGroupInvites', group) || canInvite

  return (
    <View style={styles.container}>
      <MemberList
        fetchMembers={fetchMembers}
        fetchMoreMembers={fetchMoreMembers}
        group={group}
        hasMore={hasMore}
        isFocused={isFocused}
        isServerSearch
        members={members}
        pending={pending}
        search={search}
        setSearch={setSearch}
        setSort={setSort}
        showMember={showMember}
        slug={slug}
        sortBy={sortBy}
        sortKeys={sortKeys}
      >
        {group && (
          <Banner
            bannerUrl={group.bannerUrl}
            name={group.name}
            group={group}
            handleInviteOnPress={goToInvitePeople}
            showInviteButton={showInviteButton}
          />
        )}
      </MemberList>
    </View>
  )
}

export function Banner ({ name, bannerUrl, showInviteButton, handleInviteOnPress }) {
  const { t } = useTranslation()
  return (
    <View style={styles.bannerContainer}>
      <FastImage source={{ uri: bannerUrl }} style={styles.image} />
      <LinearGradient style={styles.gradient} colors={bannerlinearGradientColors} />
      <View style={styles.titleRow}>
        <Text style={styles.name}>{name}</Text>
      </View>
      {showInviteButton && (
        <Button
          text={t('Invite')}
          style={styles.inviteButton}
          iconName='Invite'
          onPress={handleInviteOnPress}
        />
      )}
    </View>
  )
}
