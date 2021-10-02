import React, { useLayoutEffect } from 'react'
import {
  Image,
  View,
  Text,
  TouchableOpacity
} from 'react-native'
import { useSelector } from 'react-redux'
import getSignedIn from 'store/selectors/getSignedIn'
import styles from './InviteExpired.styles'

const axolotlImage = require('assets/Axel_Fretting.png')

export default function InviteExpired ({ navigation }) {
  const signedIn = useSelector(getSignedIn)
  const goBack = () => navigation.goBack()
  const goToLogin = () => navigation.navigate('Login')

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Invitation Expired'})
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Sorry, this Invitation has expired or already been used</Text>
        <Text style={{ height: 40 }}></Text>
        <Text style={styles.bodyText}>Contact your moderator for another one.</Text>
      </View>
      <Image style={styles.image} resizeMode='stretch' source={axolotlImage} />
      <View style={styles.paddedRow}>
        <TouchableOpacity onPress={signedIn ? goBack : goToLogin} style={styles.goToLoginButton}>
          {signedIn
            ? <Text style={styles.goToLoginButtonText}>Go Back</Text>
            : <Text style={styles.goToLoginButtonText}>Log In</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}
