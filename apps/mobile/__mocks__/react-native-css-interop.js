module.exports = {
  getColorScheme: jest.fn(() => 'light'), // Mock default value
  useColorScheme: jest.fn(() => 'light'), // Also mock useColorScheme
  registerCSSInterop: jest.fn()
}
