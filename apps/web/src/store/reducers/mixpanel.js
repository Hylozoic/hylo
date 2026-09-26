import mixpanel from 'mixpanel-browser'

// Mixpanel is initialized by initAnalytics (util/analytics), which also applies
// the stored cookie consent
export default (state = mixpanel, action) => state
