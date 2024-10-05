import updateGroupSettings from 'store/actions/updateGroupSettings'

it('updateGroupSettings', () => {
  expect(updateGroupSettings(123, { name: 'blah', description: 'some desc' })).toMatchSnapshot()
})
