// Apply migrations for older pipeline definitions
export function stepMigrations(step) {
  if (step && step.kernel && step.kernel.name == "ir") {
    step.kernel.name = "r";
  }
  return step;
}
