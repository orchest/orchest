export const validProjectName = (
  projectName: string | undefined
): { valid: true } | { valid: false; reason: string } => {
  if (projectName === undefined || projectName.length === 0) {
    return {
      valid: false,
      reason: "Project name cannot be empty.",
    };
  }
  if (projectName.match("[^A-Za-z0-9_.-]")) {
    return {
      valid: false,
      reason:
        "A project name has to be a valid git repository name and" +
        " thus can only contain alphabetic characters, numbers and" +
        " the special characters: '_.-'. The regex would be" +
        " [A-Za-z0-9_.-].",
    };
  }

  return { valid: true };
};
