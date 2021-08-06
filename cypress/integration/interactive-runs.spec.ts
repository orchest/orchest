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

    [
      {
        a: 1,
        b: [1, 2, 3],
        c: "hello",
        d: { e: ["f"], g: {} },
      },
    ].forEach((parameters) => {
      it("creates and runs a step with pipeline parameters", () => {
        // Change the pipeline parameters.
        cy.findByTestId(TEST_ID.PIPELINE_SETTINGS).click();
        cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_TAB_CONFIGURATION).click();
        cy.wait(1000);
        cy.get(".CodeMirror-line")
          .first()
          .click()
          .type("{selectall}{backspace}");
        cy.get(".CodeMirror-line")
          .first()
          .click()
          .type(`${JSON.stringify(parameters)}`, {
            parseSpecialCharSequences: false,
          });
        cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_SAVE).click();
        cy.wait("@allPosts");
        cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_CLOSE).click();

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

        cy.readFile(STEPS.DUMP_ENV_PARAMS.default_output_file)
          .its("pipeline_parameters")
          .should("deep.equal", parameters);
      });

      [
        {
          project_env_vars_names: ["a", "b", "c"],
          project_env_vars_values: ["1", "2", "3"],
          pipelines_env_vars_names: ["b", "c", "d"],
          pipelines_env_vars_values: ["2", "override", "4"],
        },
      ].forEach((envVars) => {
        assert(
          envVars.project_env_vars_names.length ==
            envVars.project_env_vars_values.length
        );
        assert(
          envVars.pipelines_env_vars_names.length ==
            envVars.pipelines_env_vars_values.length
        );
        it("creates and runs a step with project and pipeline env vars", () => {
          cy.addProjectEnvVars(
            PROJECT_NAMES.P1,
            envVars.project_env_vars_names,
            envVars.project_env_vars_values
          );
          cy.addPipelineEnvVars(
            PIPELINE_NAMES.PL1,
            envVars.pipelines_env_vars_names,
            envVars.pipelines_env_vars_values
          );
          cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_CLOSE).click();

          // Copy the step file (notebook).
          cy.exec(
            `cp ${STEPS.DUMP_ENV_PARAMS.get_path()} userdir/projects/${
              PROJECT_NAMES.P1
            }/`
          );

          // Create the step and set the notebook.
          cy.createStep(STEP_NAMES.ST1, false, STEPS.DUMP_ENV_PARAMS.name);

          // Select the step. Assumes unique step names.
          cy.get(`[data-test-title=${STEP_NAMES.ST1}]`)
            .scrollIntoView()
            .click();
          cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_INCOMING_STEPS).should(
            "not.exist"
          );

          cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();

          cy.get(`[data-test-title=${STEP_NAMES.ST1}]`)
            .scrollIntoView()
            .contains("Completed", { timeout: 10000 });

          let expectedEnv = {};
          // Note that we are overriding the proj env vars with pipeline
          // vars by setting them through a dictionary.
          for (let i = 0; i < envVars.project_env_vars_names.length; i++) {
            expectedEnv[envVars.project_env_vars_names[i]] =
              envVars.project_env_vars_values[i];
          }
          for (let i = 0; i < envVars.pipelines_env_vars_names.length; i++) {
            expectedEnv[envVars.pipelines_env_vars_names[i]] =
              envVars.pipelines_env_vars_values[i];
          }

          cy.readFile(STEPS.DUMP_ENV_PARAMS.default_output_file)
            .its("env")
            .then((env) => {
              Object.keys(expectedEnv).forEach((key) => {
                assert(env[key] == expectedEnv[key]);
              });
            });
        });
      });
    });
  });
});
