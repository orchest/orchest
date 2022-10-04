export const isValidJson = (jsonAsString: string) => {
  try {
    if (jsonAsString.trim() === "") return true;
    JSON.parse(jsonAsString);
    return true;
  } catch (error) {
    return false;
  }
};
