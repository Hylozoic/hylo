import { capeCod } from '@hylo/presenters/colors'
import Colors from '../../style/theme-colors'

export default {
  header: {
    marginBottom: 0
  },
  nameRow: {
    flexDirection: 'row',
    marginBottom: 5
  },
  name: {
    fontSize: 24,
    color: capeCod,
    fontFamily: 'Circular-Bold'
  },
  icons: {
    flexDirection: 'row',
    marginLeft: 'auto',
    paddingLeft: 10
  },
  icon: {
    fontSize: 30,
    color: Colors.foreground60,
    marginRight: 10
  },
  lastIcon: {
    fontSize: 30,
    color: Colors.foreground60
  },
  location: {
    fontSize: 16,
    color: Colors.foreground80,
    fontFamily: 'Circular-Book',
    marginBottom: 10
  },
  tagline: {
    marginBottom: 10,
    fontSize: 16,
    color: Colors.foreground80,
    fontFamily: 'Circular-Book'
  }
}
