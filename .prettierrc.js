module.exports = {
  plugins: [require("prettier-plugin-organize-imports")],
  overrides: [
    {
      files: "**.md",
      options: {
        printWidth: 100,
        // Prettier markdown support doesn't support definition lists yet:
        // https://github.com/prettier/prettier/issues/10701
        // Afterwards can be put to "always"
        proseWrap: "preserve",
      },
    },
  ],
};
