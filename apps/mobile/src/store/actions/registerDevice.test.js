import registerDevice from './registerDevice'

it('behaves as expected', () => {
  expect(registerDevice('foo')).toMatchSnapshot()
})
