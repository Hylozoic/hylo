import Colors from '../../style/theme-colors'

export const childCommentIndentation = 30

export default {
  // IMPORTANT: Because this is an inverted SectionList this will make
  // the "footer" rise to the top of the view when the content is
  // shorter than full height
  contentContainerStyle: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingTop: 100
  },

  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loading: {
    marginBottom: 15
  },
  showMore: {
    marginLeft: 15,
    marginRight: 12,
    marginBottom: 15,
    fontSize: 13,
    color: Colors.selected
  },
  childComment: {
    marginLeft: childCommentIndentation
  },
  childCommentsShowMore: {
    marginLeft: childCommentIndentation + 15
  }
}
