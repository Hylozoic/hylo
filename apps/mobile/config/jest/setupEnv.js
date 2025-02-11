jest.mock('react-native-config', () => ({
  API_URL: 'https://mock-api.example.com',
  SENTRY_DSN_URL: 'mock-dsn',
  FEATURE_FLAG_NEW_UI: true
}))
