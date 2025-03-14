import { white } from 'style/colors'

const hasTextShadow = {
  textShadowColor: 'rgba(0, 0, 0, 0.25)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 7
}

export default {
  container: {
    backgroundColor: white,
    flex: 1
  },
  bannerContainer: {
    zIndex: 10,
    height: 142,
    marginBottom: 10,
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'flex-end'
  },
  image: {
    height: 142,
    width: '100%',
    position: 'absolute'
  },
  gradient: {
    height: 142,
    width: '100%',
    position: 'absolute'
  },
  titleRow: {
    position: 'absolute',
    left: 0,
    bottom: 56,
    marginHorizontal: 16,
    flexDirection: 'row'
  },
  name: {
    fontSize: 24,
    fontFamily: 'Circular-Black',
    color: white,
    backgroundColor: 'transparent',
    ...hasTextShadow
  },
  //
  inviteButton: {
    width: 110,
    borderColor: 'transparent',
    marginLeft: 'auto',
    marginRight: 10,
    marginBottom: 20,
    height: 35,
    fontSize: 14
  }
}
