// DEPRECATED: This native screen is no longer used.
// All functionality is now handled by PrimaryWebView displaying the web app.
// Kept for reference only.

import React from 'react'
import { View } from 'react-native'
import { modalScreenName } from 'hooks/useIsModalScreen'
import MemberList from 'components/MemberList/MemberList'
import styles from './ProjectMembers.styles'

export default function ProjectMembers ({ route, navigation }) {
  const { members } = route.params
  const showMember = id => navigation.navigate(modalScreenName('Member'), { id })

  return (
    <View style={styles.container}>
      <MemberList
        members={members}
        hideSortOptions
        showMember={showMember}
      />
    </View>
  )
}
