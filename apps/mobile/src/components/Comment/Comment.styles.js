import { limedSpruce, slateGrey80, rhino50 } from 'style/colors'

export default {
  container: {
    flexDirection: 'column',
    flex: 1,
    padding: 10,
    paddingTop: 3,
    paddingBottom: 3,
    marginRight: 10
  },
  avatar: {
    marginRight: 10
  },
  header: {
    flexDirection: 'row',
    justifyItems: 'stretch',
    marginBottom: 3
  },
  headerLeft: {
  },
  headerMiddle: {
    flex: 1
  },
  headerRight: {
    paddingTop: 3,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  highlighted: {
    backgroundColor: 'rgb(255,255,224)'
  },
  menuIcon: {
    fontSize: 20,
    paddingLeft: 10,
    color: rhino50
  },
  actionSheetIcon: {
    fontSize: 20
  },
  name: {
    color: limedSpruce,
    fontFamily: 'Circular-Bold',
    fontSize: 14
  },
  date: {
    color: slateGrey80,
    fontFamily: 'Circular-Book',
    fontSize: 12
  },
  replyLink: {
    flexDirection: 'row'
  },
  // replyLinkText: {
  //   fontSize: 12,
  //   color: slateGrey80,
  //   marginLeft: 5
  // },
  replyLinkIcon: {
    transform: [{ rotateY: '180deg' }],
    fontSize: 20,
    color: slateGrey80
  },
  imageAttachment: {
    borderRadius: 10
  },
  body: {
    paddingLeft: 42
  }
}
