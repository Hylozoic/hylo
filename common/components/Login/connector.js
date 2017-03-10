import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { login } from './actions'

function mapStateToProps (state) {
  return {error: state.loginError}
}

function mapDispatchToProps (dispatch) {
  return {
    actions: bindActionCreators({
      login
    }, dispatch)
  }
}

export default connect(mapStateToProps, mapDispatchToProps)
