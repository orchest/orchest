/** Returns `undefined` if the project name is valid, otherwise a validation message. */
export const reviewProjectNameFormat = (projectName: string | undefined) => {
  if (!projectName) {
    return "Project name cannot be empty.";
  } else if (projectName.match("[^A-Za-z0-9_.-]")) {
    return (
      "A project name has to be a valid git repository name and" +
      " thus can only contain alphabetic characters, numbers and" +
      " the special characters: '_.-'. The regex would be" +
      " [A-Za-z0-9_.-]."
    );
  } else {
    return undefined;
  }
};
