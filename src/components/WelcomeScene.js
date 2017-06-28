import React from 'react'
import {
  Button,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View
} from 'react-native'
import { connect } from 'react-redux'
import getMe from '../store/selectors/getMe'

const placeholderUser = {
  name: 'Axolotl',
  avatarUrl: 'https://d3ngex8q79bk55.cloudfront.net/user/13986/avatar/1444260480878_AxolotlPic.png'
}

class WelcomeScene extends React.Component {
  constructor (props) {
    super(props)
    this.state = {}
  }

  render () {
    const { currentUser, navigation } = this.props
    const { name, avatarUrl } = currentUser || placeholderUser
    const showFeed = () =>
      navigation.navigate('Feed')

    return <View style={styles.container}>
      <Text style={styles.fineprint}>
        Cmd+R: reload
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        Cmd+D/shake: dev menu
      </Text>
      <Text style={styles.welcome}>
        Hello, {name}!
      </Text>
      <Image source={{uri: avatarUrl}} style={styles.axolotl} />
      <Button onPress={showFeed} title='Show feed' />
    </View>
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingTop: 80
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10
  },
  instructions: {
    textAlign: 'center',
    color: '#fff',
    marginBottom: 5
  },
  fineprint: {
    opacity: 0.7,
    fontSize: 12
  },
  axolotl: {
    width: 100,
    height: 100
  },
  input: {
    height: 40,
    width: Number(Dimensions.get('window').width),
    textAlign: 'center',
    fontStyle: 'italic'
  }
})

const mapStateToProps = state => ({currentUser: getMe(state)})
export default connect(mapStateToProps)(WelcomeScene)
