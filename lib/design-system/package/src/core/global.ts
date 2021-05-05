import { global } from "./config";

export const globalStyles = global({
  "*, *::before, *::after": { boxSizing: "border-box" },
  "body, h1, h2, h3, h4, p, figure, blockquote, dl, dd": {
    margin: "0",
  },
  "ul, ol": {
    margin: 0,
    padding: 0,
  },
  'ul[role="list"], ol[role="list"]': { listStyle: "none" },
  html: { "@motionSafe": { scrollBehavior: "smooth" } },
  body: {
    include: "minHeightScreen",
    backgroundColor: "$background",
    fontSize: "$base",
    lineHeight: "$base",
    fontFamily: "$inter",
    color: "$text",
    overflowY: "scroll",
    // textRendering: "optimizeSpeed",
    WebkitTextSizeAdjust: "100%",
    msTextSizeAdjust: "100%",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  },
  "img, picture": { display: "block", maxWidth: "100%" },
  "input, button, textarea, select": { font: "inherit" },
});
