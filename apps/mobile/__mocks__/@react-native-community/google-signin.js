export const GoogleSignin = {
  signIn: jest.fn(() => Promise.resolve({ foo: 'bar' })),
  configure: jest.fn()
}
