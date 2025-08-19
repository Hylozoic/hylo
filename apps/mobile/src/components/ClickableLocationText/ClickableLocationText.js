import React from 'react'
import { Text, TouchableOpacity, Linking, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'

/**
 * Component that renders location text with clickable links
 * Detects URLs and makes them clickable while preserving the rest of the text
 */
export default function ClickableLocationText ({ text, style, className, ...props }) {
  const { t } = useTranslation()

  // Function to detect URLs in text
  const detectUrls = (text) => {
    // Regex to match various URL patterns including Zoom links, Google Meet, Teams, and other common meeting platforms
    const urlRegex = /(https?:\/\/[^\s]+|zoom\.us\/[^\s]+|meet\.google\.com\/[^\s]+|teams\.microsoft\.com\/[^\s]+|discord\.gg\/[^\s]+|slack\.com\/[^\s]+|webex\.com\/[^\s]+|gotomeeting\.com\/[^\s]+|join\.skype\.com\/[^\s]+)/gi
    const parts = text.split(urlRegex)
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <TouchableOpacity
            key={index}
            onPress={() => handleUrlPress(part)}
          >
            <Text className={`${className || ''} text-blue-500 underline`} style={style} selectable={props.selectable}>
              {part}
            </Text>
          </TouchableOpacity>
        )
      }
      return (
        <Text key={index} className={className || ''} style={style} selectable={props.selectable}>
          {part}
        </Text>
      )
    })
  }

  // Function to handle URL press
  const handleUrlPress = async (url) => {
    try {
      // Ensure URL has protocol
      const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`
      const supported = await Linking.canOpenURL(urlWithProtocol)
      
      if (supported) {
        await Linking.openURL(urlWithProtocol)
      } else {
        Alert.alert(
          t('Cannot open link'),
          t('This link cannot be opened on your device'),
          [{ text: t('OK') }]
        )
      }
    } catch (error) {
      Alert.alert(
        t('Error opening link'),
        t('There was an error opening this link'),
        [{ text: t('OK') }]
      )
    }
  }

  if (!text) return null

  return (
    <>
      {detectUrls(text)}
    </>
  )
}
