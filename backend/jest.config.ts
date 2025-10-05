module.exports = {
  "testEnvironment": "node",
  "setupFilesAfterEnv": [
    "<rootDir>/jest.setup.js"
  ],
  "testMatch": [
    "**/__tests__/**/*.test.js",
    "**/?(*.)+(spec|test).js"
  ],
  "collectCoverageFrom": [
    "src/**/*.{js,ts}",
    "!src/**/*.d.ts",
    "!src/migrations/**",
    "!src/seeds/**"
  ],
  "coverageReporters": [
    "text",
    "lcov",
    "html"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  },
  "testTimeout": 30000,
  "maxWorkers": 4,
  "verbose": true,
  "forceExit": true,
  "detectOpenHandles": true,
  "preset": "ts-jest"
};