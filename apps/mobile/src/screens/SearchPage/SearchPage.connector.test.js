import { mapStateToProps, mapDispatchToProps, mergeProps } from './SearchPage.connector'
import { MODULE_NAME, initialState } from './SearchPage.store'

const minState = {
  [MODULE_NAME]: initialState,
  queryResults: {},
  pending: {}
}

describe('mapStateToProps', () => {
  it('matches last snapshot', () => {
    const stateProps = mapStateToProps(minState, {})
    expect(stateProps).toMatchSnapshot()
  })
})

describe('mapDispatchToProps', () => {
  it('matches last snapshot', () => {
    const dispatchProps = mapDispatchToProps(() => {}, {})
    expect(dispatchProps).toMatchSnapshot()
  })
})

describe('mergeProps', () => {
  it('matches last snapshot', () => {
    const stateProps = mapStateToProps(minState, {})
    const dispatchProps = mapDispatchToProps(() => {}, {})
    const mergedProps = mergeProps(stateProps, dispatchProps, {})
    expect(mergedProps).toMatchSnapshot()
  })
})
