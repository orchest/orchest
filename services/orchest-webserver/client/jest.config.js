/* eslint-disable @typescript-eslint/no-var-requires */
const { pathsToModuleNameMapper } = require("ts-jest");
const { compilerOptions } = require("./tsconfig");

module.exports = {
  verbose: true,
  preset: "ts-jest",
  globals: {
    "ts-jest": {
      babelConfig: require("./babel.config.js"),
    },
  },
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: "<rootDir>/",
  }),
  testMatch: [
    "**/tests/**/*.+(ts|tsx|js)",
    "**/?(*.)+(spec|test).+(ts|tsx|js)",
  ],
  transform: {
    "^.+\\.[t|j]sx?$": "<rootDir>/customTransformer.js",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  coverageDirectory: "<rootDir>/reports",
  coverageReporters: ["lcov", "text"],
  reporters: [
    "default",
    [
      "jest-junit",
      {
        suiteName: "jest tests",
        suiteNameTemplate: "{filepath}",
        outputDirectory: "reports",
        classNameTemplate: "{filename}",
        titleTemplate: "{title}",
        ancestorSeparator: " > ",
      },
    ],
  ],
  collectCoverageFrom: ["<rootDir>/**/*.{js,jsx,ts,tsx}"],
  modulePathIgnorePatterns: ["<rootDir>/*/__mocks__/*.mock.{js,jsx,ts,tsx}"],
  testEnvironment: "jsdom",
  testURL: "http://localhost:8080",
};
