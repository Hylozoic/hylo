import { LOCATION_CHANGE } from 'redux-first-history'

const initialState = {
  previousLocation: null,
  currentLocation: null
}

export default (state = initialState, action) => {
  switch (action.type) {
    case LOCATION_CHANGE:
      if (action.payload.location.pathname.includes('settings')) {
        // XXX: hacky way to ignore settings modal location changes, so that we can go back to the previous location when the settings modal is closed
        return state
      }
      return {
        previousLocation: state.currentLocation,
        currentLocation: action.payload.location
      }
    default:
      return state
  }
}
