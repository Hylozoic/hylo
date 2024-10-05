import React from 'react'
import { View, Text, Image } from 'react-native'
import Button from 'components/Button'
import styles from './CreateGroupNotice.styles'
import { useTranslation } from 'react-i18next'

const axolotlImage = require('assets/hey-axolotl.png')

export default function CreateGroupNotice ({ goToCreateGroup, text }) {
  const { t } = useTranslation()
  return (
    <View style={styles.container}>
      <Text style={styles.promptText}>{text}</Text>
      <Image style={styles.image} source={axolotlImage} />
      <Button
        text={t('Start a Group')}
        style={styles.button}
        onPress={goToCreateGroup}
      />
    </View>
  )
}
