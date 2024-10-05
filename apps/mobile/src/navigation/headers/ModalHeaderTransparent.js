import { TouchableOpacity, View, StyleSheet } from 'react-native'
import Icon from 'components/Icon'
import { suvaGrey, white } from 'style/colors'

export default function ModalHeaderTransparent ({ navigation, ...params }) {
  return {
    title: '',
    headerTransparent: true,
    headerLeft: () => (
      <TouchableOpacity onPress={() => params?.headerLeftOnPress ? params.headerLeftOnPress() : navigation.goBack()}>
        <View style={styles.iconBackground}>
          <Icon name='Ex' style={styles.icon} />
        </View>
      </TouchableOpacity>
    )
  }
}

const styles = StyleSheet.create({
  iconBackground: {
    width: 30,
    backgroundColor: white,
    opacity: 0.8,
    height: 30,
    borderRadius: 30 / 2,
    alignContent: 'center',
    justifyContent: 'center',
    marginLeft: 10
  },
  icon: {
    color: suvaGrey,
    fontSize: 24,
    lineHeight: 24,
    alignSelf: 'center'
  }
})
