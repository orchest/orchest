export const isMacOs = () => {
  const platform = window.navigator.userAgent || window.navigator.platform;
  return platform.toUpperCase().indexOf("MAC") >= 0;
};
