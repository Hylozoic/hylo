import React from 'react'

// Placeholder linking configuration
export const prefixes = ['hylo://', 'https://hylo.com', 'https://www.hylo.com']
export const DEFAULT_APP_HOST = 'https://hylo.com'
export const staticPages = ['/terms', '/privacy']

export const customLinking = {
  prefixes,
  config: {
    screens: {
      NonAuthRoot: {
        screens: {
          Login: 'login',
          ForgotPassword: 'reset-password',
          Signup: 'signup'
        }
      }
    }
  }
}

export const navigationRef = React.createRef()