import React, { useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'

// Emergency debug component that shows even when main WebView fails
const WebViewDebugFallback = ({ onPress, message = 'WebView Component Failed to Render' }) => {
  const [dismissed, setDismissed] = useState(false)
  
  if (!__DEV__ || dismissed) return null

  return (
    <View style={{
      position: 'absolute',
      bottom: 20,
      left: 10,
      right: 10,
      backgroundColor: '#ff4444',
      borderRadius: 8,
      zIndex: 500
    }}>
      <View style={{
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 8,
        margin: 2
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', flex: 1 }}>
            🚨 WebView Debug: {message}
          </Text>
          <TouchableOpacity 
            onPress={() => setDismissed(true)}
            style={{ padding: 5 }}
          >
            <Text style={{ fontSize: 16, fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          onPress={() => {
            console.log('=== WEBVIEW FALLBACK DEBUG ===')
            console.log('WebView component failed to render properly')
            console.log('This usually indicates:')
            console.log('1. Session cookie retrieval failed')
            console.log('2. Component props are invalid')
            console.log('3. React Native context is corrupted')
            
            // Try to access global debug utilities
            if (global.webViewDebugUtils) {
              console.log('Running state diagnosis...')
              global.webViewDebugUtils.logWebViewState()
            } else {
              console.warn('webViewDebugUtils not available')
            }
            
            if (onPress) onPress()
          }}
          style={{
            backgroundColor: '#ff4444',
            padding: 8,
            borderRadius: 4,
            alignItems: 'center'
          }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>
            🔍 Debug & Log Details
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default WebViewDebugFallback
