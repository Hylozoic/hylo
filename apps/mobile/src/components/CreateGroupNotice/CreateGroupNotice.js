import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import Button from 'components/Button'
import Colors from '../../style/theme-colors'

const axolotlImage = require('assets/hey-axolotl.png')

export default function CreateGroupNotice () {
  const { t } = useTranslation()
  const navigation = useNavigation()

  const handleOnPress = () => navigation.navigate('Create Group')
  const text = t('noPostsExplanierNewUser')

  return (
    <View style={styles.container}>
      <Text style={styles.promptText}>{text}</Text>
      <Image style={styles.image} source={axolotlImage} />
      <Button text={t('Start a Group')} style={styles.button} onPress={handleOnPress} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white'
  },
  promptText: {
    marginTop: 40,
    marginBottom: 20,
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: 10,
    paddingRight: 10,
    fontSize: 20,
    textAlign: 'center',
    color: Colors.foreground50
  },
  image: {
    marginLeft: 'auto',
    marginRight: 'auto',
    height: 220,
    width: 250,
    marginBottom: 40
  },
  button: {
    width: 200,
    height: 40,
    marginLeft: 'auto',
    marginRight: 'auto',
    fontSize: 14
  }
})
