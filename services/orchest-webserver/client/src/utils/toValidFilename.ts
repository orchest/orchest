/**
 *
 * @param title any string
 * @param replaceBy the token to replace non-word characters, default "_"
 * @returns a string that could be a valid file name
 *
 * NOTE: we default to underscore because Python file names cannot contain dashes
 * so we don't introduce inconsistencies to Python users
 */
export const toValidFilename = (title: string, replaceBy = "_") => {
  const nonWord = replaceBy !== "-" ? /\W/g : /[^\w-]/g;
  return title.replace(nonWord, replaceBy).toLowerCase();
};
