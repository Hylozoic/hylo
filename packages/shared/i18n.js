import 'intl-pluralrules'
import i18next from 'i18next'

// NOTE: This instance of i18n is currently available for both Web and Mobile and other
// @hylo/* front-end only  modules, but not yet applied to the Backend.
// If we want to add functions here in @hylo/shared which which require translation
// access we need to amend the Backend Sails configuration to have it use this i18n
// instance. That looks to be do'able but would require a little research. See:
// https://sailsjs.com/documentation/concepts/internationalization

export const i18n = i18next.createInstance({}, (err, t) => {
  if (err) return console.log('something went wrong loading', err)
})

export default i18n
