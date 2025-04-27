import React from 'react'
import { View, Text, TouchableOpacity, Linking } from 'react-native'
import { filter } from 'lodash/fp'
import { File } from 'lucide-react-native'

export default function CardFileAttachments ({
  attachments = [],
  className
}) {
  const fileAttachments = filter({ type: 'file' }, attachments)

  return (
    <View className={className}>
      {fileAttachments.map((fileAttachment, i) =>
        <CardFileAttachment fileAttachment={fileAttachment} key={i} />)}
    </View>
  )
}

export function CardFileAttachment ({
  fileAttachment = {}
}) {
  const handlePress = async () => {
    try {
      await Linking.openURL(fileAttachment.url)
    } catch (error) {
      console.error('Error opening file:', error)
    }
  }

  const fileName = decodeURIComponent(new URL(fileAttachment.url).pathname.split('/').pop())

  return (
    <TouchableOpacity
      className='rounded-lg bg-midground p-2 flex-row items-center gap-2 shadow-sm mb-1 active:opacity-80'
      onPress={handlePress}
    >
      <File className='text-foreground' size={20} />
      <Text className='text-foreground flex-1' numberOfLines={1}>{fileName}</Text>
    </TouchableOpacity>
  )
} 