import { connect } from 'react-redux'
import { loginWithApple, loginWithFacebook, loginWithGoogle } from 'screens/Login/actions'
import { getPending } from 'screens/Login/Login.store'

export function mapStateToProps (state, props) {
  const goToSignupFlow = () => props.navigation.navigate('Signup - Email Verification')
  const goToLogin = () => props.navigation.navigate('Login')
  return {
    goToSignupFlow,
    goToLogin,
    error: state.session.loginError,
    pending: getPending(state)
  }
}

export const mapDispatchToProps = {
  loginWithApple, loginWithFacebook, loginWithGoogle
}

export default connect(mapStateToProps, mapDispatchToProps)
