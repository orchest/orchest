import {
  assertTotalEnvironmentImages,
  reset,
  SAMPLE_PROJECT_NAMES,
  TEST_ID,
} from "../support/common";

describe("environments", () => {
  beforeEach(() => {
    cy.disableCheckUpdate();
    reset();
    cy.setOnboardingCompleted("true");
    cy.createProject(SAMPLE_PROJECT_NAMES.P1);
    // Delete the environment that has been created with the project.
    cy.deleteAllEnvironments();
  });

  context("should have no environment images after running", () => {
    afterEach(() => {
      assertTotalEnvironmentImages(0);
    });

    it("creates an environment", () => {
      cy.createEnvironment("myname");
      cy.visit("environments");
      cy.findAllByTestId("environment-list-row")
        .should("have.length", 1)
        .should("contain", "myname");
    });

    it("creates an environment and builds it, deletes the environment while it's building", () => {
      // Make sure the env is still building when we issue the delete.
      cy.createEnvironment("test", "sleep 10", true);
      cy.deleteAllEnvironments();
    });

    it("creates an environment and builds it, cancels the build while it's building", () => {
      // Make sure the env is still building when we issue the cancel.
      cy.createEnvironment("test", "sleep 10", true);
      cy.findByTestId(TEST_ID.ENVIRONMENTS_CANCEL_BUILD).click();
    });

    it("creates an environment and builds it, waits for the build then deletes the environment", () => {
      cy.createEnvironment("test", undefined, true, true);
      cy.deleteAllEnvironments();
    });

    it("creates and build multiple environments, delete all of them during the build", () => {
      Array.from(Array(3).keys()).map((env) => {
        cy.createEnvironment(env.toString(), "sleep 100000", true);
      });
      cy.deleteAllEnvironments(3);
    });
  });
});
