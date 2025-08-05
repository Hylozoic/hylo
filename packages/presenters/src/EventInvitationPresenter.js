export const RESPONSES = {
  YES: 'yes',
  NO: 'no',
  INTERESTED: 'interested'
}

export const humanResponse = (response) => {
  return {
    yes: 'Going',
    no: 'Not Going',
    interested: 'Interested'
  }[response]
}
