import { mapStateToProps, mapDispatchToProps } from './MessageInput.connector'
import { MODULE_NAME } from 'screens/NewMessage/NewMessage.store'

describe('mapStateToProps', () => {
  it('returns the right keys', () => {
    expect(mapStateToProps({ [MODULE_NAME]: {} }, {})).toMatchSnapshot()
  })
})

describe('mapDispatchToProps', () => {
  it('contains the right keys', () => {
    expect(mapDispatchToProps).toMatchSnapshot()
  })
})
