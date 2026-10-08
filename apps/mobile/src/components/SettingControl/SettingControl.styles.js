import {
  caribbeanGreen,
  white60onCaribbeanGreen,
  white40onCaribbeanGreen,
  amaranth,
  white
} from '@hylo/presenters/colors'

export default {
  control: {
    position: 'relative'
  },
  label: {
    fontFamily: 'Circular-Bold',
    fontSize: 14,
    color: white60onCaribbeanGreen
  },
  textInput: {
    fontFamily: 'Circular-Book',
    fontSize: 18,
    color: 'white',
    borderBottomWidth: 1,
    borderBottomColor: white40onCaribbeanGreen,
    paddingBottom: 6,
    marginBottom: 15
  },
  buttonText: {
    fontFamily: 'Circular-Medium',
    fontSize: 16,
    color: caribbeanGreen
  },
  toggles: {
    flexDirection: 'row',
    top: 20,
    right: 0,
    position: 'absolute'
  },
  eyeIcon: {
    fontSize: 20,
    color: white40onCaribbeanGreen,
    marginRight: 10
  },
  editIcon: {
    fontSize: 20,
    opacity: 0.5
  },
  errorWrapper: {
    alignItems: 'center',
    marginBottom: 10
  },
  error: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 100,
    backgroundColor: amaranth
  },
  errorText: {
    color: white,
    fontSize: 12
  },
  errorTriangle: {
    backgroundColor: amaranth
  },
  highlight: {
    backgroundColor: '#99EEFF',
    borderRadius: 4
  }
}
