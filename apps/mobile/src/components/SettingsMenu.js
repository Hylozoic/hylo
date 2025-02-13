import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { alabaster, capeCod, rhino40, rhino80 } from 'style/colors'

export default function SettingsMenu ({ title, settingsOptions, WebViewComponent }) {
  const [selectedSetting, setSelectedSetting] = useState(null)

  return (
    <View style={[styles.container]}>
      {selectedSetting && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedSetting(null)} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
        </View>
      )}
      {selectedSetting
        ? (
          <WebViewComponent path={selectedSetting.path} uri={selectedSetting.uri} />
          )
        : (
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
