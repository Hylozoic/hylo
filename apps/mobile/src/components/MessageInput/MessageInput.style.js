import { alabaster, mercury } from 'style/colors'

// Deliberately not a StyleSheet, too many calls to `flatten` required!
export default {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alabaster, // flag-messages-background-color
    borderRadius: 4,
    marginHorizontal: 5,
    paddingHorizontal: 5,
    paddingBottom: 3,
    shadowColor: mercury,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    shadowOpacity: 0.1,

    // Android-only
    elevation: 2
  },
  input: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Circular-Book',
    marginLeft: 5,
    paddingVertical: 0
  },
  sendButton: {
    fontSize: 50
  }
}
