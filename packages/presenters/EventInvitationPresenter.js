import i18n from '@hylo/shared/i18n'

export const RESPONSES = {
  YES: 'yes',
  NO: 'no',
  INTERESTED: 'interested'
}

export const humanResponse = (response) => {
  const { t } = i18n
  return {
    yes: t('Going'),
    no: t('Not Going'),
    interested: t('Interested')
  }[response]
}
