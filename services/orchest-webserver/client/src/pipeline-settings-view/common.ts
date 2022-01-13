export const getOrderValue = () => {
  const lsKey = "_monotonic_getOrderValue";
  // returns monotinically increasing digit
  if (!window.localStorage.getItem(lsKey)) {
    window.localStorage.setItem(lsKey, "0");
  }
  let value = parseInt(window.localStorage.getItem(lsKey)) + 1;
  window.localStorage.setItem(lsKey, value + "");
  return value;
};
