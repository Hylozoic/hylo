// DEPRECATED: This screen is no longer used in the app.
// All content (including group settings) is now handled by PrimaryWebView.
// The web app provides the settings interface.
// Kept for reference - may revisit native implementation in the future.
// Last used: 2025-01-26

import React, { useCallback } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import useGroup from '@hylo/hooks/useGroup'
import useRouteParams from 'hooks/useRouteParams'
import HyloWebView from 'components/HyloWebView'
import { amaranth, capeCod, rhino40, rhino80, twBackground } from '@hylo/presenters/colors'

export default function GroupSettingsWebView () {
  const navigation = useNavigation()
  const { groupSlug, settingsArea: routeSettingsArea, originalLinkingPath, } = useRouteParams()
  const [, queryGroup] = useGroup({ groupSlug, useQueryArgs: { requestPolicy: 'network-only', pause: true } })
  const goToSettingsArea = useCallback(settingsArea => {
    navigation.push('Group Settings', { originalLinkingPath: `/groups/${groupSlug}/settings/${settingsArea}` })
  }, [groupSlug])

  // Debug logging for notification navigation
  if (__DEV__) {
    console.log('🔍 GroupSettingsWebView Debug:', {
      groupSlug,
      settingsArea: routeSettingsArea,
      originalLinkingPath,
      allRouteParams: useRouteParams()
    })
  }

  // Always re-queries group onBlur
  useFocusEffect(
    useCallback(() => {
      return () => {
        queryGroup()
      }
    }, [])
  )

  const settingsOptions = [
    { settingsArea: '', label: 'Group Details' },
    { settingsArea: 'agreements', label: 'Agreements' },
    { settingsArea: 'welcome', label: 'Welcome Page' },
    { settingsArea: 'responsibilities', label: 'Responsibilities' },
    { settingsArea: 'roles', label: 'Roles & Badges' },
    { settingsArea: 'privacy', label: 'Privacy & Access' },
    { settingsArea: 'topics', label: 'Topics' },
    { settingsArea: 'invite', label: 'Invitations' },
    { settingsArea: 'requests', label: 'Join Requests' },
    { settingsArea: 'relationships', label: 'Related Groups' },
    { settingsArea: 'export', label: 'Export Data' },
    { settingsArea: 'delete', label: 'Delete', style: { color: amaranth } }
  ]

  if (routeSettingsArea !== 'index') {
    return (
      <HyloWebView path={originalLinkingPath} />
    )
  }

  return (
    <View style={[styles.container]}>
      <ScrollView contentContainerStyle={styles.menu}>
        {settingsOptions.map(({ settingsArea, label, style }) => (
          <TouchableOpacity
            key={settingsArea}
            style={styles.menuItem}
            onPress={() => goToSettingsArea(settingsArea)}
          >
            <Text style={[styles.menuText, style]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: twBackground
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: capeCod,
    height: 60
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: twBackground
  },
  backButton: {
    position: 'absolute',
    left: 20,
    zIndex: 10
  },
  backButtonText: {
    fontSize: 20,
    color: 'white'
  },
  menu: {
    paddingVertical: 10
  },
  menuItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 10,
    marginHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: rhino40,
    backgroundColor: twBackground
  },
  menuText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: rhino80
  }
})
