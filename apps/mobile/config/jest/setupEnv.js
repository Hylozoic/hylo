jest.mock('react-native-config', () => ({
  NODE_ENV: 'test',
  API_HOST: 'https://mock-api.example.com',
  SENTRY_DSN_URL: 'mock-dsn',
  FEATURE_FLAG_NEW_UI: true
}))
