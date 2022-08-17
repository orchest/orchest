export const commaSeparatedString = (arr: string[]) => {
  const listStart = arr.slice(0, -1).join(", ");
  const listEnd = arr.slice(-1);
  const conjunction = arr.length <= 1 ? "" : " and ";

  return [listStart, listEnd].join(conjunction);
};

export const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1);
