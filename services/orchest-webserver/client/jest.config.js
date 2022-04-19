/* eslint-disable @typescript-eslint/no-var-requires */
const { pathsToModuleNameMapper } = require("ts-jest");
const { compilerOptions } = require("./tsconfig");

module.exports = {
  verbose: true,
  preset: "ts-jest",
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: "<rootDir>/",
  }),
  transform: {
    "^.+\\.[t|j]sx?$": [
      "esbuild-jest",
      {
        sourcemap: true,
        loaders: { ".test.ts": "tsx" },
      },
    ],
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
  collectCoverageFrom: ["src/**/*.{js,jsx,ts,tsx}"],
  modulePathIgnorePatterns: ["__mocks__"],
  testEnvironment: "jsdom",
  testURL: "http://localhost:8080",
};
