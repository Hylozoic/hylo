import React, { useCallback, useEffect, useState } from 'react'
import { View, FlatList, Text, TouchableOpacity } from 'react-native'
import { useScrollToTop } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { gql, useQuery } from 'urql'
import { isFunction, filter, values, keys, debounce, size } from 'lodash/fp'
import useCurrentGroup from 'frontend-shared/hooks/useCurrentGroup'
import useHasResponsibility from 'frontend-shared/hooks/useHasResponsibility'
import useRolesForGroup from 'frontend-shared/hooks/useRolesForGroup'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import PopupMenuButton from 'components/PopupMenuButton'
import SearchBar from 'components/SearchBar'
import CondensingBadgeRow from '../CondensingBadgeRow/CondensingBadgeRow'
import styles from './MemberList.styles'

const groupMembersQuery = gql`
  query GroupMembersQuery ($slug: String, $first: Int, $sortBy: String, $offset: Int, $search: String) {
    group (slug: $slug) {
      id
      name
      avatarUrl
      bannerUrl
      memberCount
      members (first: $first, sortBy: $sortBy, offset: $offset, search: $search) {
        items {
          id
          name
          bio
          avatarUrl
          location
          locationObject {
            id
            addressNumber
            addressStreet
            bbox {
              lat
              lng
            }
            center {
              lat
              lng
            }
            city
            country
            fullText
            locality
            neighborhood
            region
          }
          tagline
          groupRoles {
            items {
              id
              name
              emoji
              active
              groupId
              responsibilities {
                items {
                  id
                  title
                  description
                }
              }
            }
          }
          membershipCommonRoles {
            items {
              id
              commonRoleId
              groupId
              userId
            }
          }
          skills {
            hasMore
            items {
              id
              name
            }
          }
        }
        hasMore
      }
    }
  }
`

export default function MemberList ({
  members: providedMembers = [],
  children = '',
  hideSortOptions = false,
  // For server-based searches only
  isServerSearch,
  showMember,
  slug = ''
}) {
  const { t } = useTranslation()
  const scrollRef = React.useRef(null)
  useScrollToTop(scrollRef)
  const [{ currentGroup: group }] = useCurrentGroup()

  const [searchString, setSearchString] = useState('')
  // these keys must match the values that hylo-node can handle
  const sortKeys = {
    name: 'Name',
    location: 'Location',
    join: 'Newest'
  }
  const [sortBy, setSortBy] = useState('name')

  const [offset, setOffset] = useState(0)
  const [{ data, fetching }] = useQuery({
    query: groupMembersQuery,
    variables: {
      first: 20,
      offset,
      search: searchString,
      slug: group?.slug,
      sortBy
    },
    pause: !isServerSearch
  })
  const [members, setMembers] = useState(!isServerSearch && providedMembers)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    if (isServerSearch) {
      setMembers(data?.group?.members?.items)
      setHasMore(data?.group?.members?.hasMore)
    }
  }, [isServerSearch, data])

  useEffect(() => {
    if (!isServerSearch) {
      const membersFilter = member => member.name.toLowerCase().includes(searchString.toLowerCase())
      setMembers(m => filter(membersFilter, providedMembers))
    }
  }, [searchString])

  const handleSearch = debounce(300, text => setSearchString(text))

  const fetchMoreMembers = useCallback(() => {
    if (hasMore && !fetching) {
      setOffset(members?.length)
    }
  }, [hasMore, fetching])

  const actions = isServerSearch
    ? values(sortKeys).map((value, index) => [value, () => setSortBy(keys(sortKeys)[index])])
    : []

  // sort of a hack since members need to be even since it's rows of 2. fixes flexbox
  const membersForFlatList = (size(members) % 2 > 0)
    ? members.concat([{ id: -1 }])
    : members

  t('Newest')
  t('Name')
  t('Location')

  const header = (
    <View>
      {children || null}
      <View style={styles.listControls}>
        <SearchBar
          placeholder={t('Search Members')}
          onChangeText={handleSearch}
          style={styles.searchWrapper}
        />
        {!hideSortOptions && (
          <PopupMenuButton actions={actions} style={styles.sortBy}>
            <Text style={styles.sortByText}>{sortKeys && t(sortKeys[sortBy])}</Text>
            <Icon name='ArrowDown' style={styles.downArrow} />
          </PopupMenuButton>
        )}
      </View>
    </View>
  )

  return (
    <FlatList
      ref={scrollRef}
      data={membersForFlatList}
      numColumns='2'
      renderItem={({ item }) => {
        if (item.name) {
          return <Member group={group} member={item} showMember={showMember} />
        } else {
          return <View style={styles.cell} />
        }
      }}
      onEndReached={isServerSearch && fetchMoreMembers}
      keyExtractor={(item, index) => item.id}
      ListHeaderComponent={header}
      ListFooterComponent={fetching ? <Loading style={{ paddingTop: 10 }} /> : null}
    />
  )
}

export function Member ({ member, showMember, group }) {
  const badges = useRolesForGroup(group?.id, member)
  // // TODO: URQL - Steward case? -- https://terrans.slack.com/archives/G01HM5VHD8X/p1732263229830789
  // if (responsibility === null) {
  //   // TODO: Shouldn't the '1', etc values be taken from constants?
  //   return responsibilities.some(r => ['1', '3', '4'].includes(r.id))
  // }
  const hasResponsibility = useHasResponsibility({ groupId: group.id, person: member })
  const creatorIsSteward = group ? hasResponsibility(null) : []

  return (
    <TouchableOpacity
      onPress={() => isFunction(showMember) && showMember(member.id)}
      style={[styles.cell, styles.memberCell]}
    >
      <View style={styles.avatarSpacing}>
        <Avatar avatarUrl={member.avatarUrl} dimension={72} />
      </View>
      <Text style={styles.memberName}>{member.name}</Text>
      {!!member.location &&
        <Text style={styles.memberLocation}>{member.location}</Text>}
      <CondensingBadgeRow badges={badges} limit={32} creatorIsSteward={creatorIsSteward} currentGroup={group} containerStyle={styles.badgeRow} />
      {/* The limit is just a unrealistically large number here */}
      <Text style={styles.memberBio} numberOfLines={4}>
        {member.bio}
      </Text>
    </TouchableOpacity>
  )
}
