import { createCss } from "@stitches/react";
import { mixins } from "stitches-mixins";

const colors = {
  white: "#FFFFFF",
  black: "#000000",
  blue50: "#e0eeff",
  blue100: "#b0ccff",
  blue200: "#7faaff",
  blue300: "#4381ff",
  blue400: "#1e65fe",
  blue500: "#074ce5",
  blue600: "#003bb3",
  blue700: "#002a81",
  blue800: "#001950",
  blue900: "#000820",
  gray50: "#fafafa",
  gray100: "#f5f5f5",
  gray200: "#eeeeee",
  gray300: "#e0e0e0",
  gray400: "#bdbdbd",
  gray500: "#9e9e9e",
  gray600: "#757575",
  gray700: "#616161",
  gray800: "#424242",
  gray900: "#212121",
};

export const stitches = createCss({
  theme: {
    colors: {
      ...colors,
      primary: colors.blue300,
      link: "$primary",
      linkHover: colors.blue400,
      background: colors.white,
      text: colors.black,
      progressBarBackground: colors.gray300,
      progressBarIndicator: colors.black,
      skeleton: colors.gray300,
    },
    space: {
      1: "0.25rem",
      2: "0.5rem",
      3: "0.75rem",
      4: "1rem",
      5: "1.25rem",
      6: "1.5rem",
      7: "1.75rem",
      8: "2rem",
      9: "2.25rem",
      10: "2.5rem",
      11: "2.75rem",
      12: "3rem",
    },
    sizes: {
      "3xs": "12rem",
      "2xs": "16rem",
      xs: "20rem",
      sm: "24rem",
      "3xl": "48rem",
      "4xl": "56rem",
    },
    fonts: {
      inter:
        'Inter, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    },
    fontWeights: {
      normal: 400,
      bold: 600,
    },
    fontSizes: {
      base: "1rem",
      xs: "0.75rem",
      sm: "0.875rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
      "5xl": "3rem",
    },
    lineHeights: {
      base: "1.5rem",
      sm: "1.25rem",
      lg: "1.75rem",
      xl: "1.75rem",
      "2xl": "2rem",
      "3xl": "2.25rem",
      "4xl": "2.5rem",
      "5xl": "1",
    },
    radii: {
      sm: "0.25rem",
      rounded: "9999px",
    },
  },
  media: {
    hoverSafe: "(hover: hover)",
    motionSafe: "(prefers-reduced-motion: no-preference)",
    sm: "(min-width: 640px)",
    md: "(min-width: 768px)",
    lg: "(min-width: 1024px)",
    xl: "(min-width: 1280px)",
    "2xl": "(min-width: 1536px)",
  },
  utils: {
    include: mixins(),
    inset: (config) => (
      value:
        | keyof typeof config["theme"]["space"]
        | (string & {})
        | (number & {})
    ) => ({
      top: value,
      right: value,
      bottom: value,
      left: value,
    }),
  },
});

export const {
  styled,
  css,
  theme,
  getCssString,
  global,
  keyframes,
  config,
} = stitches;
