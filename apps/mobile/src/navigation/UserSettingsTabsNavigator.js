import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserSettingsWebView from 'screens/UserSettingsWebView';
import { alabaster, capeCod, rhino30 } from 'style/colors';

export default function UserSettingsScreen() {
  const insets = useSafeAreaInsets()
  const [selectedSetting, setSelectedSetting] = useState(null);

  const settingsOptions = [
    { name: 'Edit Profile', path: '/settings' },
    { name: 'Affiliations', path: '/settings/groups' },
    { name: 'Invites & Requests', path: '/settings/invitations' },
    { name: 'Notifications', path: '/settings/notifications' },
    { name: 'Account', path: '/settings/account' },
    { name: 'Saved Searches', path: '/settings/saved-searches' },
    { name: 'Terms & Privacy', uri: 'https://hylo-landing.surge.sh/terms' },
  ];

  return (
    <View style={[styles.container, { marginTop: insets.top, marginBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        {selectedSetting && (
          <TouchableOpacity onPress={() => setSelectedSetting(null)} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>
          {selectedSetting ? selectedSetting.name : 'Settings'}
        </Text>
      </View>

      {/* Content: Either WebView or Menu List */}
      {selectedSetting ? (
        <UserSettingsWebView path={selectedSetting.path} uri={selectedSetting.uri} />
      ) : (
        <ScrollView contentContainerStyle={styles.menu}>
          {settingsOptions.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => setSelectedSetting(option)}
            >
              <Text style={styles.menuText}>{option.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: alabaster,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: capeCod, // Ensures header visibility
    height: 60, // Explicit height to make sure it's seen
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white', // Adjusted for better contrast
  },
  backButton: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  backButtonText: {
    fontSize: 20,
    color: 'white', // Ensures visibility
  },
  menu: {
    paddingVertical: 10,
  },
  menuItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: capeCod,
  },
  menuText: {
    fontSize: 16,
    color: rhino30,
  },
});