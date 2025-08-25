import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import Colors from '../style/theme-colors'
import useRouteParams from 'hooks/useRouteParams'

export default function Unknown () {
  const routeParams = useRouteParams()

  return (
    <View style={[styles.container]}>
      <Text className='text-lg font-bold text-foreground'>Route Not Found</Text>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.codeBlock}>
          {JSON.stringify(routeParams, null, 2)}
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 20
  },
  scrollView: {
    maxHeight: '60%', // Limits height, making it scrollable
    width: '90%', // Ensures it doesn't stretch too wide
    borderWidth: 1,
    borderColor: Colors.mutedForeground,
    borderRadius: 8,
    backgroundColor: Colors.muted, // White background for the "code editor"
    marginTop: 20
  },
  scrollContent: {
    maxHeight: '60%', // Limits height, making it scrollable
    width: '90%', // Ensures it doesn't stretch too wide
    borderWidth: 1,
    borderColor: Colors.mutedForeground,
    borderRadius: 8,
    backgroundColor: Colors.muted, // White background for the "code editor"
    marginTop: 20
  },
  scrollContentText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
    color: Colors.foreground
  },
  codeBlock: {
    fontSize: 14,
    color: Colors.foreground,
    fontFamily: 'monospace', // Ensures fixed-width font
    textAlign: 'left'
  }
})
