import { TEST_ID, STEPS, PIPELINES } from "../support/common";

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

// Function private to the file to  set the parameters of a step in the
// editor.
function setStepParameters(stepTitle, params) {
  cy.intercept("POST", /.*/).as("allPosts");
  cy.get(`[data-test-title=${stepTitle}]`)
    .scrollIntoView()
    .click({ force: true });

  // Delete the current content.
  cy.get(".CodeMirror-line")
    .first()
    .click()
    // Note that doing a {selectall} followed by a {backspace} does not
    // seem to work, it results in the parameters we are typing next
    // being "mangled", i.e. initial chars randomly disappearing.
    .type("{backspace}".repeat(20));
  // Write our params.
  cy.get(".CodeMirror-line")
    .first()
    .click()
    .type(`${JSON.stringify(params)}`, {
      parseSpecialCharSequences: false,
    });
  cy.wait("@allPosts");
}

describe("interactive runs", () => {
  beforeEach(() => {
    cy.setOnboardingCompleted("true");
    cy.createProject(PROJECT_NAMES.P1);
    cy.visit("/pipelines");
  });

  context("requires an empty pipeline and a running session", () => {
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
      cy.get(`[data-test-title=${STEP_NAMES.ST1}]`)
        .scrollIntoView()
        .click({ force: true });
      cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_INCOMING_STEPS).should(
        "not.exist"
      );
      cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();

      cy.get(`[data-test-title=${STEP_NAMES.ST1}]`)
        .scrollIntoView()
        .contains("Completed", { timeout: 20000 });
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

        setStepParameters(STEP_NAMES.ST1, parameters);

        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_INCOMING_STEPS).should(
          "not.exist"
        );
        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();

        cy.get(`[data-test-title=${STEP_NAMES.ST1}]`)
          .scrollIntoView()
          .contains("Completed", { timeout: 20000 });
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
        cy.intercept("POST", /.*/).as("allPosts");
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
        cy.get(`[data-test-title=${STEP_NAMES.ST1}]`)
          .scrollIntoView()
          .click({ force: true });
        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_INCOMING_STEPS).should(
          "not.exist"
        );

        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();

        cy.get(`[data-test-title=${STEP_NAMES.ST1}]`)
          .scrollIntoView()
          .contains("Completed", { timeout: 20000 });

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
            .click({ force: true });
          cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_INCOMING_STEPS).should(
            "not.exist"
          );

          cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();

          cy.get(`[data-test-title=${STEP_NAMES.ST1}]`)
            .scrollIntoView()
            .contains("Completed", { timeout: 20000 });

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

  context("requires the data passing pipeline and a running session", () => {
    beforeEach(() => {
      // Copy the pipeline.
      cy.exec(
        `cp -r ${PIPELINES.DATA_PASSING.get_path()} userdir/projects/${
          PROJECT_NAMES.P1
        }/`
      );
      cy.visit("/pipelines");
      cy.findByTestId(`pipeline-${PIPELINES.DATA_PASSING.name}`).click();
      cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).contains(
        "Stop session",
        { timeout: 30000 }
      );
    });

    [
      {
        input_data: {
          a: 1,
          b: ["2", "3"],
          c: { d: { e: "hello" } },
        },
      },
      {
        input_data: {
          a: 1,
          b: ["2", "3"],
          c: { d: { e: "hello" } },
        },
        input_data_name: "output_name",
      },
    ].forEach((paramsA) => {
      it(`tests data passing - ${
        paramsA.input_data_name === undefined ? "unnamed" : "named"
      }`, () => {
        cy.findByTestId(TEST_ID.PIPELINE_CENTER);

        setStepParameters("A", paramsA);

        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_INCOMING_STEPS).should(
          "not.exist"
        );
        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();

        cy.get(`[data-test-title=${"A"}]`).contains("Completed", {
          timeout: 20000,
        });

        // Press ESC to close the step menu.
        cy.get("body").trigger("keydown", { keyCode: 27 });
        cy.wait(100);
        cy.get("body").trigger("keyup", { keyCode: 27 });

        // Select and run B.
        cy.wait(100);
        cy.get(`[data-test-title=${"B"}]`).click();

        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();
        cy.get(`[data-test-title=${"B"}]`).contains("Completed", {
          timeout: 20000,
        });

        let expectedName =
          paramsA.input_data_name === undefined
            ? "unnamed"
            : paramsA.input_data_name;
        let expectedValue =
          paramsA.input_data_name === undefined
            ? [paramsA.input_data]
            : paramsA.input_data;

        cy.readFile(PIPELINES.DATA_PASSING.default_output_file)
          .its(expectedName)
          .should("deep.equal", expectedValue);
      });
    });

    [
      {
        eviction: true,
        stepParams: {
          input_data: {
            a: 1,
            b: ["2", "3"],
            c: { d: { e: "hello" } },
          },
        },
      },
      {
        eviction: false,
        stepParams: {
          input_data: {
            a: 1,
            b: ["2", "3"],
            c: { d: { e: "hello" } },
          },
        },
      },
    ].forEach((testData) => {
      it(`tests memory eviction - unnamed - eviction=${testData.eviction})`, () => {
        cy.findByTestId(TEST_ID.PIPELINE_CENTER);

        // Activate memory eviction and restart the memory server.
        if (testData.eviction) {
          cy.findByTestId(TEST_ID.PIPELINE_SETTINGS).click();
          cy.findByTestId(
            TEST_ID.PIPELINE_SETTINGS_CONFIGURATION_MEMORY_EVICTION
          )
            .scrollIntoView()
            .should("not.be.checked");
          cy.findByTestId(
            TEST_ID.PIPELINE_SETTINGS_CONFIGURATION_MEMORY_EVICTION
          ).check();
          cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_SAVE).click();
          cy.findByTestId(
            TEST_ID.PIPELINE_SETTINGS_CONFIGURATION_RESTART_MEMORY_SERVER
          )
            .scrollIntoView()
            .should("be.visible")
            .click();
          cy.findByTestId(
            TEST_ID.PIPELINE_SETTINGS_CONFIGURATION_RESTART_MEMORY_SERVER,
            {
              timeout: 20000,
            }
          ).should("be.enabled");
          // Get back to the pipeline editor.
          cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_CLOSE).click();
        }

        // Select and run A.
        setStepParameters("A", testData.stepParams);
        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_INCOMING_STEPS).should(
          "not.exist"
        );
        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();

        cy.get(`[data-test-title=${"A"}]`).contains("Completed", {
          timeout: 20000,
        });

        // Press ESC to close the step menu.
        cy.get("body").trigger("keydown", { keyCode: 27 });
        cy.wait(100);
        cy.get("body").trigger("keyup", { keyCode: 27 });

        // Select and run B.
        cy.wait(100);
        cy.get(`[data-test-title=${"B"}]`).click();
        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();
        cy.get(`[data-test-title=${"B"}]`).contains("Completed", {
          timeout: 20000,
        });

        let expectedName = "unnamed";
        let expectedValue = [testData.stepParams.input_data];

        cy.readFile(PIPELINES.DATA_PASSING.default_output_file)
          .its(expectedName)
          .should("deep.equal", expectedValue);
        cy.exec(`rm -f ${PIPELINES.DATA_PASSING.default_output_file}`);

        // Run B again, if memory eviction is enabled it should fail
        // because no input from A can be found.
        let expectedState = testData.eviction ? "Failure" : "Completed";
        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();
        cy.get(`[data-test-title=${"B"}]`).contains(expectedState, {
          timeout: 20000,
        });

        if (!testData.eviction) {
          cy.readFile(PIPELINES.DATA_PASSING.default_output_file)
            .its(expectedName)
            .should("deep.equal", expectedValue);
        }
      });
    });
  });
});
