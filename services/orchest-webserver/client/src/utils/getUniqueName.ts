export const getUniqueName = (defaultName: string, names: string[]) => {
  let finalName = defaultName.trim();
  const allNames = new Set(names);
  let count = 0;
  while (count < 100) {
    const newName = `${finalName}${count === 0 ? "" : ` (${count})`}`;
    if (!allNames.has(newName)) {
      finalName = newName;
      break;
    }
    count += 1;
  }
  return finalName;
};
