import { nevada, rhino, white80 } from '@hylo/presenters/colors'

export const baseStyle = {
  color: nevada,
  fontSize: 14,
  lineHeight: 20,
  fontFamily: 'Circular-Book'
}

export const tagsStyles = {
  h1: {
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 34,
    marginTop: 0,
    marginBottom: '0.5em'
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 30,
    marginTop: 0,
    marginBottom: '0.5em'
  },
  h3: {
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 26,
    marginTop: 0,
    marginBottom: '0.5em'
  },
  h4: {
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 24,
    marginTop: 0,
    marginBottom: '0.5em'
  },
  h5: {
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 22,
    marginTop: 0,
    marginBottom: '0.5em'
  },
  h6: {
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 20,
    marginTop: 0,
    marginBottom: '0.5em'
  },
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
