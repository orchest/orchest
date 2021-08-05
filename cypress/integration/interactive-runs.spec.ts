import { TEST_ID, STEPS } from "../support/common";

enum PROJECT_NAMES {
  P1 = "test-project-1",
  P2 = "test-project-2",
}

enum PIPELINE_NAMES {
  PL1 = "test-pipeline-1",
  PL2 = "test-pipeline-2",
}

enum STEP_NAMES {
  ST1 = "test-step-1",
  ST2 = "test-step-2",
}

describe("interactive runs", () => {
  beforeEach(() => {
    cy.setOnboardingCompleted("true");
    cy.createProject(PROJECT_NAMES.P1);
    cy.visit("/pipelines");
  });
  context("requires a running session", () => {
    beforeEach(() => {
      cy.createPipeline(PIPELINE_NAMES.PL1);
      cy.findByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();
      cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).contains(
        "Stop session",
        { timeout: 30000 }
      );
    });

    it("creates and runs a step", () => {
      // Copy the step file (notebook).
      cy.exec(
        `cp ${STEPS.DUMP_ENV_PARAMS.get_path()} userdir/projects/${
          PROJECT_NAMES.P1
        }/`
      );

      // Create the step and set the notebook.
      cy.createStep(STEP_NAMES.ST1, false, STEPS.DUMP_ENV_PARAMS.name);

      // Select the step. Assumes unique step names.
      cy.get(`[data-test-title=${STEP_NAMES.ST1}]`).scrollIntoView().click();
      cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_INCOMING_STEPS).should(
        "not.exist"
      );
      cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();

      cy.get(`[data-test-title=${STEP_NAMES.ST1}]`)
        .scrollIntoView()
        .contains("Completed", { timeout: 10000 });
      cy.readFile(STEPS.DUMP_ENV_PARAMS.default_output_file);
    });

    [
      {
        a: 1,
        b: [1, 2, 3],
        c: "hello",
        d: { e: ["f"], g: {} },
      },
    ].forEach((parameters) => {
      it("creates and runs a step with parameters", () => {
        // Copy the step file (notebook).
        cy.exec(
          `cp ${STEPS.DUMP_ENV_PARAMS.get_path()} userdir/projects/${
            PROJECT_NAMES.P1
          }/`
        );

        // Create the step and set the notebook.
        cy.createStep(STEP_NAMES.ST1, false, STEPS.DUMP_ENV_PARAMS.name);

        cy.get(`[data-test-title=${STEP_NAMES.ST1}]`).scrollIntoView().click();
        cy.get(".CodeMirror-line")
          .first()
          .click()
          .type("{selectall}{backspace}");
        cy.get(".CodeMirror-line")
          .first()
          .click()
          // NOTE: The spaces in front are required, otherwise there will
          // be random breakage. I have investigated for some time without
          // success. Seems to be related to the character {, but I might
          // be wrong.
          .type(`          ${JSON.stringify(parameters)}`, {
            parseSpecialCharSequences: false,
          });
        cy.wait("@allPosts");
        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_INCOMING_STEPS).should(
          "not.exist"
        );
        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();

        cy.get(`[data-test-title=${STEP_NAMES.ST1}]`)
          .scrollIntoView()
          .contains("Completed", { timeout: 10000 });
        cy.readFile(STEPS.DUMP_ENV_PARAMS.default_output_file)
          .its("step_parameters")
          .should("deep.equal", parameters);
      });
    });
  });
});
