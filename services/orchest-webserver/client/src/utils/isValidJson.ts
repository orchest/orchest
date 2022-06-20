export const isValidJson = (jsonAsString: string) => {
  try {
    JSON.parse(jsonAsString);
    return true;
  } catch (error) {
    return false;
  }
};
