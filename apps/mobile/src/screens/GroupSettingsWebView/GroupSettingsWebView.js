import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import useGroup from '@hylo/hooks/useGroup'
import useRouteParams from 'hooks/useRouteParams'
import HyloWebView from 'components/HyloWebView'
import { alabaster, amaranth, capeCod, rhino40, rhino80 } from 'style/colors'

export default function GroupSettingsWebView () {
  const navigation = useNavigation()
  const webViewRef = useRef()
  const { groupSlug, originalLinkingPath, settingsArea: routeSettingsArea } = useRouteParams()
  const [, queryGroup] = useGroup({ groupSlug, useQueryArgs: { requestPolicy: 'network-only', pause: true } })
  const [selectedSettingsArea, setSelectedSettingsArea] = useState(routeSettingsArea)

  useEffect(() => {
    setSelectedSettingsArea(routeSettingsArea)
  }, [routeSettingsArea])

  useEffect(() => {
    navigation.setOptions({
      headerLeftOnPress: (!routeSettingsArea && selectedSettingsArea) && (() => setSelectedSettingsArea())
    })
  }, [selectedSettingsArea])

  // Always re-queries group onBlur
  useFocusEffect(
    useCallback(() => {
      return () => {
        queryGroup()
      }
    }, [])
  )

  const handleNavigationStateChange = useCallback(({ url }) => {
    // // Temporary sorta fix for Group delete which reloads the page
    // if (url.match(/\/all/)) {
    //   // TODO: After deleting a group on Web the user used to be forwarded to /all. Needs to be confirm that this is still
    //   // the case, and tested if this re-query of currentUser adequately updates the list of groups for the user. It should.
    //   // queryCurrentUser is provisional and replacing what as a RNRestart() call, which we should basically never do.
    //   queryCurrentUser()
    //   return false
    // }
    if (!url.match(/\/groups\/([^/]+)settings/)) {
      webViewRef.current?.goBack()
      return false
    }
  })

  const path = useMemo(() => selectedSettingsArea
    ? `/groups/${groupSlug}/settings/${selectedSettingsArea === 'details' ? '' : selectedSettingsArea}`
    : originalLinkingPath
  , [selectedSettingsArea, originalLinkingPath])

  const settingsOptions = [
    { settingsArea: 'details', label: 'Group Details' },
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

  return (
    <View style={[styles.container]}>
      {selectedSettingsArea
        ? (
          <HyloWebView
            ref={webViewRef}
            key={path}
            path={path}
            onNavigationStateChange={handleNavigationStateChange}
          />
          )
        : (
          <ScrollView contentContainerStyle={styles.menu}>
            {settingsOptions.map(({ settingsArea, label, style }) => (
              <TouchableOpacity
                key={settingsArea}
                style={styles.menuItem}
                onPress={() => setSelectedSettingsArea(settingsArea)}
              >
                <Text style={[styles.menuText, style]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: alabaster
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
    color: alabaster
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
    backgroundColor: alabaster
  },
  menuText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: rhino80
  }
})
