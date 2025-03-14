import { nevada, rhino, white80 } from 'style/colors'

export const baseStyle = {
  color: nevada,
  fontSize: 14,
  lineHeight: 20,
  fontFamily: 'Circular-Book'
}

export const tagsStyles = {
  iframe: {
    alignSelf: 'center'
  },
  p: {
    marginTop: 0,
    marginBottom: '0.8em'
  },
  a: {
    color: '#0275d8',
    textDecorationLine: 'none'
  },
  ul: {
    marginTop: 0,
    paddingLeft: '2em'
  },

  ol: {
    marginTop: 0,
    paddingLeft: '2em'
  },
  code: {
    color: white80,
    backgroundColor: rhino,
    fontSize: 12
  },
  pre: {
    borderRadius: '0.5em',
    display: 'block',
    overflow: 'scroll',
    fontSize: 12,
    backgroundColor: rhino,
    padding: 12,
    marginTop: 0,
    marginBottom: 0
  }
}

export const classesStyles = {
  'hylo-link': {
    color: '#0DC39F'
  },
  mention: {
    color: '#0DC39F',
    textDecorationLine: 'none'
  },
  'mention-current-user': {
    color: '#FFB949'
  },
  topic: {
    color: '#0DC39F',
    textDecorationLine: 'none'
  }
}
