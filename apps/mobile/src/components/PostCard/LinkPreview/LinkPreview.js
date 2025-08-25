import React from 'react'
import { TouchableOpacity, Text, View } from 'react-native'
import { URL } from 'react-native-url-polyfill'
import useOpenURL from 'hooks/useOpenURL'
import FastImage from 'react-native-fast-image'
import Colors from '../../../style/theme-colors'

export default function LinkPreview ({ title, description, url, imageUrl }) {
  const openURL = useOpenURL()

  if (!url) return null

  const domain = new URL(url).hostname.replace('www.', '')

  return (
    <TouchableOpacity
      style={styles.linkContainer}
      onPress={() => openURL(url)}
    >
      {imageUrl && (
        <FastImage style={styles.linkImage} source={{ uri: imageUrl }} />
      )}
      <View style={styles.linkRightContainer}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkDescription} numberOfLines={2}>{description}</Text>
        <Text style={styles.linkDomain} numberOfLines={1}>{domain.toUpperCase()}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = {
  linkContainer: {
    backgroundColor: Colors.muted,
    borderRadius: 4,
          borderColor: Colors.mutedForeground,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    padding: 6,
    marginBottom: 8
  },
  linkImage: {
    borderRadius: 4,
    width: 80,
    height: 80
  },
  linkRightContainer: {
    flexDirection: 'column',
    paddingLeft: 10,
    flexShrink: 1
  },
  linkTitle: {
    color: Colors.foreground80,
    fontSize: 12,
    fontFamily: 'Circular-Bold',
    marginBottom: 4
  },
  linkDomain: {
    color: Colors.foreground50,
    fontSize: 10
  },
  linkDescription: {
    color: Colors.foreground75,
    fontSize: 10,
    marginBottom: 4
  }
}
