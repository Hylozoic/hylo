import { white, rhino80, gunsmoke, azureRadiance, rhino10, amaranth } from 'style/colors'

export default {
  keyboardAccessoryContainerStyle: {
    backgroundColor: white,
    marginBottom: 0,
    borderWidth: 0
  },

  editor: {
    display: 'flex',
    flexDirection: 'row',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'flex-end'
  },

  htmlEditor: {
    minHeight: 42,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 10
  },

  prompt: {
    borderTopWidth: 1,
    borderColor: rhino10,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start'
  },

  promptText: {
    color: rhino80,
    lineHeight: 22
  },

  promptTextName: {
    fontWeight: 'bold'
  },

  promptClearIcon: {
    marginRight: 5,
    fontSize: 22,
    lineHeight: 20,
    color: amaranth
  },

  submitButton: {
    fontSize: 26,
    lineHeight: 24,
    marginLeft: 8,
    marginRight: 4,
    color: gunsmoke
  },

  activeButton: {
    color: azureRadiance
  }
}
