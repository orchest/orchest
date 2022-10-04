export const isMacOs = (window.navigator.userAgent || window.navigator.platform)
  .toUpperCase()
  .includes("MAC");

export const modifierKey = isMacOs ? "⌘" : "Ctrl";
