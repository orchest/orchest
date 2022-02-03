/* eslint-disable @typescript-eslint/no-var-requires */
const { pathsToModuleNameMapper } = require("ts-jest/utils");
const { compilerOptions } = require("./tsconfig");

module.exports = {
  verbose: true,
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: "<rootDir>/",
  }),
  transform: {
    "^.+\\.[t|j]sx?$": [
      "esbuild-jest",
      {
        sourcemap: true,
        loaders: {
          ".test.ts": "tsx",
        },
      },
    ],
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
        // output: "<rootDir>/reports/junit.xml",
        outputDirectory: "reports",
        classNameTemplate: "{filename}",
        titleTemplate: "{title}",
        ancestorSeparator: " > ",
      },
    ],
  ],
  collectCoverageFrom: ["src/**/*.{js,jsx,ts,tsx}"],
  modulePathIgnorePatterns: ["__mocks__"],
};
