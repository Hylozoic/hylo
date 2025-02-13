import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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

const styles = {
  container: {
    flex: 1,
    justifyContent: 'top',
    alignItems: 'center',
    backgroundColor: '#f5f5f5' // Light background for readability
  },
  scrollView: {
    maxHeight: '60%', // Limits height, making it scrollable
    width: '90%', // Ensures it doesn't stretch too wide
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff' // White background for the "code editor"
  },
  scrollContent: {
    padding: 12,
  },
  codeBlock: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace', // Ensures fixed-width font
    textAlign: 'left'
  }
}
