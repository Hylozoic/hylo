import i18next from 'i18next'

const i18n = i18next.createInstance()

// NOTE: This instance of i18n is currently used for both Web and Mobile, but is not
// yet applied to Backend. Hence this shared instance is currently only used by the
// apps and the other @hylo/* front-end only  modules.
// If we want to add functions here in @hylo/shared which which require translation
// access we need to amend the Backend Sails configuration to have it use this i18n
// instance. That looks to be do'able but would require a little research. See:
// https://sailsjs.com/documentation/concepts/internationalization

export default i18n
