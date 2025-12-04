// DEPRECATED: This header is only used by deprecated screens.
// Kept for reference only.
// Last used: 2025-01-28

/*
import { TouchableOpacity, StyleSheet } from 'react-native'
import { X } from 'lucide-react-native'
import { suvaGrey, white } from '@hylo/presenters/colors'

export default function ModalHeaderTransparent ({ navigation, ...params }) {
  return {
    title: '',
    headerTransparent: true,
    headerLeft: () => (
      <TouchableOpacity
        style={styles.iconBackground}
        onPress={() => params?.headerLeftOnPress ? params.headerLeftOnPress() : navigation.goBack()}
      >
        <X style={styles.icon} />
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
    alignSelf: 'center'
  }
})
*/

// No-op export - header is deprecated
export default function ModalHeaderTransparent () {
  return {}
}
