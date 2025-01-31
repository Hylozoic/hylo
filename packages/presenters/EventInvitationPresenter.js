export const RESPONSES = {
  YES: 'yes',
  NO: 'no',
  INTERESTED: 'interested'
}

export const humanResponse = (response, t) => {
  return {
    yes: t('Going'),
    no: t('Not Going'),
    interested: t('Interested')
  }[response]
}
