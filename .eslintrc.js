module.exports = {
  env: {
    browser: true,
    es2020: true,
  },
  extends: [
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 11,
    sourceType: "module",
  },
  plugins: ["react", "@typescript-eslint", "react-hooks"],
  rules: {
    "prefer-const": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/ban-ts-comment": "warn",
    "@typescript-eslint/no-namespace": "warn", // for cypress
    "react/prop-types": "off",
    "react/jsx-no-target-blank": "warn",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn", // Checks effect dependencies
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  ignorePatterns: [
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/dist/**/*.ts",
    "**/dist/**/*.tsx",
  ],
};
