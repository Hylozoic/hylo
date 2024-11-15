import React from 'react'
import { useQuery } from 'urql'
import { useSelector } from 'react-redux'
import { Text, ScrollView, View, TouchableOpacity } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { openURL } from 'hooks/useOpenURL'
import useRouteParams from 'hooks/useRouteParams'
import getCurrentGroupSlug from 'store/selectors/getCurrentGroupSlug'
import GroupPresenter, { isContextGroup, PUBLIC_GROUP_ID } from 'urql-shared/presenters/GroupPresenter'
import groupDetailsQueryMaker from 'graphql/queries/groupDetailsQueryMaker'
import Icon from 'components/Icon'
import TopicsNavigation from 'components/TopicsNavigation'
import styles from './GroupNavigation.styles'
import Loading from 'components/Loading'

export default function GroupNavigation () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { myHome } = useRouteParams()
  // TODO: This is a session store value, keep in Redux or move elsewhere?
  const currentGroupSlug = useSelector(getCurrentGroupSlug)

  const [{ data, fetching }] = useQuery({
    query: groupDetailsQueryMaker({ withJoinQuestions: true, withPrerequisiteGroups: true }),
    variables: { slug: currentGroupSlug },
    pause: !currentGroupSlug
  })
  const currentGroup = GroupPresenter(data?.group)
  const childGroups = currentGroup?.childGroups?.items
  const parentGroups = currentGroup?.parentGroups?.items

  useFocusEffect(() => {
    navigation.setOptions({ title: myHome ? t('My Home') : currentGroup?.name })
  })

  if (fetching) return <Loading />

  const { navigate } = navigation
  const customViews = (currentGroup && currentGroup.customViews?.items) || []
  const navItems = myHome
    ? [
        { label: t('Create'), iconName: 'Create', onPress: () => navigate('Edit Post', { id: null }) },
        { label: t('My Posts'), iconName: 'Posticon', onPress: () => navigate('My Posts') },
        { label: t('Interactions'), iconName: 'Support', onPress: () => navigate('Interactions') },
        { label: t('Mentions'), iconName: 'Email', onPress: () => navigate('Mentions') },
        { label: t('Announcements'), iconName: 'Announcement', onPress: () => navigate('Announcements') }
      ]
    : [
        { label: t('Create'), iconName: 'Create', onPress: () => navigate('Edit Post', { id: null }) },
        { label: t('Stream'), iconName: 'Stream', onPress: () => navigate('Stream') },
        {
          label: t('Explore'),
          iconName: 'Binoculars',
          onPress: () => navigate('Group Explore', { groupSlug: currentGroup?.slug }),
          hidden: isContextGroup(currentGroup?.slug)
        },
        { label: t('Projects'), iconName: 'Projects', onPress: () => navigate('Projects') },
        { label: t('Events'), iconName: 'Events', onPress: () => navigate('Events') },
        {
          label: t('Members'),
          iconName: 'Members',
          onPress: () => navigate('Members'),
          hidden: isContextGroup(currentGroup?.slug)
        },
        {
          label: t('Decisions'),
          iconName: 'Proposal',
          onPress: () => navigate('Decisions'),
          hidden: isContextGroup(currentGroup?.slug)
        },
        {
          label: t('Groups'),
          iconName: 'Groups',
          onPress: () => navigate('Group Relationships', { group: currentGroup }),
          hidden: !(childGroups?.length > 0 || parentGroups?.length > 0)
        },
        { label: t('Map'), iconName: 'Globe', onPress: () => navigate('Map') },
        ...customViews.filter(customView => customView.name && (customView.type !== 'externalLink' || customView.externalLink)).map(customView => ({
          label: customView.name,
          iconName: customView.icon,
          // onPress: customView.type !== 'externalLink' ? `${rootPath}/custom/${customView.id}` : false,
          onPress: customView.type === 'externalLink'
            ? () => openURL(customView.externalLink)
            : () => navigate('Stream', { customViewId: customView?.id })
        }))
      ]

  const shownNavItems = navItems.filter(navItem => !navItem?.hidden)

  return (
    <ScrollView style={styles.container}>
      {shownNavItems.map(item => <NavItem {...item} key={item.label} />)}
      {currentGroup?.id !== PUBLIC_GROUP_ID && !myHome && (
        <>
          <View style={styles.divider} />
          <View style={styles.navItems}>
            <NavItem label={t('Topics')} iconName='Topics' onPress={() => navigate('Topics')} />
            <TopicsNavigation group={currentGroup} />
          </View>
        </>
      )}
    </ScrollView>
  )
}

const NavItem = ({ label, iconName, onPress }) => (
  <TouchableOpacity style={styles.navItem} onPress={onPress} key={label}>
    <Icon style={styles.navItemIcon} name={iconName} />
    <Text style={styles.navItemLabel}>{label}</Text>
  </TouchableOpacity>
)
