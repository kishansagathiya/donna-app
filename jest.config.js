module.exports = {
  preset: '@react-native/jest-preset',
  testPathIgnorePatterns: ['/node_modules/', '/ios/Pods/'],
  moduleNameMapper: {
    'react-native-sse': '<rootDir>/__mocks__/react-native-sse.js',
  },
};
