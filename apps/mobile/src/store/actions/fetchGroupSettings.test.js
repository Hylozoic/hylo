import fetchGroupSettings from 'store/actions/fetchGroupSettings'

it('fetchGroupSettings', () => {
  expect(fetchGroupSettings(10)).toMatchSnapshot()
})
