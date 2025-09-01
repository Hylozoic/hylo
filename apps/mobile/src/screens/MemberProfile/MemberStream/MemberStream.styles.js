import Colors from '../../../style/theme-colors'

const screenMargin = 16

const option = {
  color: Colors.foreground50,
  fontSize: 15,
  paddingVertical: 10,
  paddingHorizontal: 15
}

export default {
  superContainer: {
    backgroundColor: 'white',
    flex: 1
  },
  container: {
    backgroundColor: 'white'
  },
  streamTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: screenMargin,
    marginBottom: 16
  },
  option,
  chosenOption: {
    ...option,
    color: Colors.foreground,
    backgroundColor: Colors.background20,
    fontFamily: 'Circular-Bold'
  },
  contentRow: {
    marginHorizontal: screenMargin,
    marginBottom: 16
  },
  footer: {
    paddingBottom: 40
  }
}
