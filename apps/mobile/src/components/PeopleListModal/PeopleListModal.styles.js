import { StyleSheet } from 'react-native'
import { capeCod, rhino, rhino30 } from 'style/colors'

export default StyleSheet.create({
  modal: {
    marginTop: 50,
    justifyContent: 'flex-start'
  },
  container: {
    height: '60%',
    // width: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'flex-start',
    justifyContent: 'center',
    shadowColor: rhino,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  closeIcon: {
    fontSize: 24,
    color: rhino30
  },
  modalContent: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    marginTop: 22
  },
  message: {
    fontSize: 14,
    marginTop: 20,
    fontFamily: 'Circular-Book'
  },
  personRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    alignItems: 'center'
  },
  personAvatar: {
    marginRight: 8
  },
  personName: {
    color: capeCod,
    fontFamily: 'Circular-Bold',
    fontSize: 18
  }
})
