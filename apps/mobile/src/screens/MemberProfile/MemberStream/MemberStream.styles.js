import { rhino, rhino50, alabaster } from 'style/colors'

const screenMargin = 16

const option = {
  color: rhino50,
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
    color: rhino,
    backgroundColor: alabaster,
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
