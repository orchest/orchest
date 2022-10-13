import {
  assertEnvIsBuilt,
  mergeEnvVariables,
  piped_click,
  PIPELINES,
  reloadUntilElementsLoaded,
  reset,
  SAMPLE_PIPELINE_NAMES,
  SAMPLE_PROJECT_NAMES,
  SAMPLE_STEP_NAMES,
  setStepParameters,
  STEPS,
  TEST_ID,
} from "../support/common";

describe("interactive runs", () => {
  beforeEach(() => {
    cy.disableCheckUpdate();
    reset();
    cy.setOnboardingCompleted("true");
    cy.createProject(SAMPLE_PROJECT_NAMES.P1);
    assertEnvIsBuilt();
    cy.navigateViaTopMenu("pipeline");
  });

  context("requires an empty pipeline and a running session", () => {
    beforeEach(() => {
      cy.createPipeline(SAMPLE_PIPELINE_NAMES.PL1);
      cy.findByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();
      cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).contains(
        "Stop session",
        { timeout: 60000 }
      );
    });

    it("creates and runs a step", () => {
      // Copy the step file (notebook).
      cy.exec(
        `cp ${STEPS.DUMP_ENV_PARAMS.get_path()} ../userdir/projects/${
          SAMPLE_PROJECT_NAMES.P1
        }/`
      );

      cy.reload(true);

      // Create the step and set the notebook.
      cy.createStep(SAMPLE_STEP_NAMES.ST1, false, STEPS.DUMP_ENV_PARAMS.name);

      // Select the step. Assumes unique step names.
      cy.intercept("POST", /async\/project-files\/exists/).as("fileExists");
      cy.get(`[data-test-title=${SAMPLE_STEP_NAMES.ST1}]`)
        .scrollIntoView()
        .click({ force: true });
      cy.wait("@fileExists");
      cy.findByTestId(TEST_ID.FILE_PICKER_FILE_PATH_TEXTFIELD).should("exist");
      cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_INCOMING_STEPS).should(
        "not.exist"
      );
      cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();

      cy.get(`[data-test-title=${SAMPLE_STEP_NAMES.ST1}]`)
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
          `cp ${STEPS.DUMP_ENV_PARAMS.get_path()} ../userdir/projects/${
            SAMPLE_PROJECT_NAMES.P1
          }/`
        );
        cy.reload(true);

        // Create the step and set the notebook.
        cy.createStep(SAMPLE_STEP_NAMES.ST1, false, STEPS.DUMP_ENV_PARAMS.name);

        setStepParameters(SAMPLE_STEP_NAMES.ST1, parameters);

        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_INCOMING_STEPS).should(
          "not.exist"
        );
        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();

        cy.get(`[data-test-title=${SAMPLE_STEP_NAMES.ST1}]`)
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
          `cp ${STEPS.DUMP_ENV_PARAMS.get_path()} ../userdir/projects/${
            SAMPLE_PROJECT_NAMES.P1
          }/`
        );
        cy.reload(true);

        // Create the step and set the notebook.
        cy.createStep(SAMPLE_STEP_NAMES.ST1, false, STEPS.DUMP_ENV_PARAMS.name);

        // Select the step. Assumes unique step names.
        cy.intercept("POST", /async\/project-files\/exists/).as("fileExists");
        cy.get(`[data-test-title=${SAMPLE_STEP_NAMES.ST1}]`)
          .scrollIntoView()
          .click({ force: true });
        cy.wait("@fileExists");
        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_INCOMING_STEPS).should(
          "not.exist"
        );

        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();

        cy.get(`[data-test-title=${SAMPLE_STEP_NAMES.ST1}]`)
          .scrollIntoView()
          .contains("Completed", { timeout: 20000 });

        cy.readFile(STEPS.DUMP_ENV_PARAMS.default_output_file)
          .its("pipeline_parameters")
          .should("deep.equal", parameters);
      });

      const projectEnvVars = {
        names: ["a", "b", "c"],
        values: ["1", "2", "3"],
      };

      const pipelineEnvVars = {
        names: ["b", "c", "d"],
        values: ["2", "override", "4"],
      };

      // ensure the testing data is valid
      assert(projectEnvVars.names.length === projectEnvVars.values.length);
      assert(pipelineEnvVars.names.length === pipelineEnvVars.values.length);

      it("creates and runs a step with project and pipeline env vars", () => {
        cy.addProjectEnvVars(
          SAMPLE_PROJECT_NAMES.P1,
          projectEnvVars.names,
          projectEnvVars.values
        );
        cy.addPipelineEnvVars(
          SAMPLE_PIPELINE_NAMES.PL1,
          pipelineEnvVars.names,
          pipelineEnvVars.values
        );
        cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_CLOSE).click();

        // Copy the step file (notebook).
        cy.exec(
          `cp ${STEPS.DUMP_ENV_PARAMS.get_path()} ../userdir/projects/${
            SAMPLE_PROJECT_NAMES.P1
          }/`
        );
        cy.reload(true);

        // Create the step and set the notebook.
        cy.createStep(SAMPLE_STEP_NAMES.ST1, false, STEPS.DUMP_ENV_PARAMS.name);

        // Select the step. Assumes unique step names.
        cy.intercept("POST", /async\/project-files\/exists/).as("fileExists");
        cy.get(`[data-test-title=${SAMPLE_STEP_NAMES.ST1}]`)
          .scrollIntoView()
          .click({ force: true });
        cy.wait("@fileExists");
        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_INCOMING_STEPS).should(
          "not.exist"
        );

        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();

        cy.get(`[data-test-title=${SAMPLE_STEP_NAMES.ST1}]`)
          .scrollIntoView()
          .contains("Completed", { timeout: 20000 });

        let expectedEnv = mergeEnvVariables([
          [projectEnvVars.names, projectEnvVars.values],
          [pipelineEnvVars.names, pipelineEnvVars.values],
        ]);

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

  context("requires the data passing pipeline and a running session", () => {
    beforeEach(() => {
      if (Cypress.$("pipeline-list-row").length > 0) {
        cy.deleteAllPipelines();
      }
      // Copy the pipeline.
      cy.exec(
        `cp -r ${PIPELINES.DATA_PASSING.get_path()} ../userdir/projects/${
          SAMPLE_PROJECT_NAMES.P1
        }/`
      );
      // Need to force a reload for discovery.
      cy.reload(true);
      cy.visit("/pipelines");
      reloadUntilElementsLoaded("pipeline-list-row", () => {
        cy.findByTestId("pipeline-list").should("exist");
        return cy.findByTestId("loading-table-row").should("not.exist");
      });
      cy.findByTestId(`pipeline-list-row`).first().click();
      cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).contains(
        "Stop session",
        { timeout: 60000 }
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

        // Close the step menu.
        cy.findByTestId(TEST_ID.STEP_CLOSE_DETAILS).pipe(piped_click);

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
      it(`tests memory eviction - unnamed - eviction=${testData.eviction}`, () => {
        cy.findByTestId(TEST_ID.PIPELINE_CENTER);

        // Activate memory eviction and restart the memory server.
        if (testData.eviction) {
          cy.findByTestId(TEST_ID.PIPELINE_SETTINGS).click();
          cy.findByTestId(
            TEST_ID.PIPELINE_SETTINGS_CONFIGURATION_MEMORY_EVICTION
          )
            .find("input")
            .scrollIntoView()
            .should("not.be.checked");
          cy.findByTestId(
            TEST_ID.PIPELINE_SETTINGS_CONFIGURATION_MEMORY_EVICTION
          )
            .find("input")
            .check();
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
        cy.findByTestId(TEST_ID.STEP_CLOSE_DETAILS).pipe(piped_click);

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

        // This check is needed to avoid the next check finding the old
        // step state and moving on, which can happen if it takes long
        // enough for the request to run the step to complete.  Checking
        // if the CANCEL RUN button is there does not suffice because it
        // appears before the step state is updated, that is, it's
        // possible for the CANCEL RUN button to be there while the step
        // state is still the old "COMPLETED".
        // An alternative is to wait for the POST runs request to be
        // done, but there might still be a race condition where the
        // step state is checked before it's rerendered.
        cy.get(`[data-test-title=${"B"}]`).contains(/Pending|Running/, {
          timeout: 20000,
        });

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
