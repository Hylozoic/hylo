import { mapStateToProps } from './Comments.connector'
import { FETCH_COMMENTS } from 'store/constants'

jest.mock('store/selectors/getMe', () => () => {})

describe('mapStateToProps', () => {
  it('sets pending correctly', () => {
    const props = {
      pending: {
        Control: true
      },
      queryResults: {}
    }
    expect(mapStateToProps(props, {}).pending).toEqual(undefined)
    expect(mapStateToProps({
      ...props,
      pending: { [FETCH_COMMENTS]: true }
    }, {}).pending).toEqual(true)
  })
})
