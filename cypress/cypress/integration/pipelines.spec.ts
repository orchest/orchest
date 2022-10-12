import {
  assertEnvIsBuilt,
  piped_click,
  PROJECTS_DIR,
  reloadUntilElementsLoaded,
  reset,
  SAMPLE_PIPELINE_NAMES,
  SAMPLE_PROJECT_NAMES,
  SAMPLE_STEP_NAMES,
  TEST_ID,
  waitForJupyterlab,
} from "../support/common";

let pathTestCases = [
  ["/a", "a"],
  ["./a", "a"],
  ["/b/c/../a", "b/a"],
  // More than one initial slash is actually a special case:
  // https://stackoverflow.com/questions/52260324/why-os-path-normpath-does-not-remove-the-firsts
  ["//b/c/../a", "b/a"],
  ["///b/c/../a", "b/a"],
  ["b/c/../a", "b/a"],
  ["b/././a", "b/a"],
];

describe("pipelines", () => {
  beforeEach(() => {
    cy.disableCheckUpdate();
    reset();
    cy.setOnboardingCompleted("true");
    cy.createProject(SAMPLE_PROJECT_NAMES.P1);
    cy.navigateViaTopMenu("pipeline");
  });

  it("creates a pipeline", () => {
    cy.createPipeline(SAMPLE_PIPELINE_NAMES.PL1);
    let expectedFile = `${SAMPLE_PIPELINE_NAMES.PL1.replaceAll(
      "-",
      "_"
    )}.orchest`;
    cy.readFile(`${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}/${expectedFile}`);
  });

  it("creates a pipeline, modifies the path", () => {
    let path = `my-super-test.orchest`;
    cy.createPipeline(SAMPLE_PIPELINE_NAMES.PL1, path);
    cy.readFile(`${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}/${path}`);
  });

  it("creates a pipeline, modifies the path to be a directory that does not exist", () => {
    let path = `a/b/c/my-super-test.orchest`;
    cy.createPipeline(SAMPLE_PIPELINE_NAMES.PL1, path);
    cy.readFile(`${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}/${path}`);
  });

  it("creates a pipeline, copies the file", () => {
    cy.createPipeline(SAMPLE_PIPELINE_NAMES.PL1);
    let expectedFile = `${SAMPLE_PIPELINE_NAMES.PL1.replaceAll(
      "-",
      "_"
    )}.orchest`;
    // Make a copy of the file, expect Orchest to pick it up as a new
    // pipeline.
    let originalPath = `${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}/${expectedFile}`;
    let copyPath = `${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}/copy.orchest`;
    cy.exec(`cp ${originalPath} ${copyPath}`);
    // Reload to force the discovery.
    cy.visit("/pipelines");
    reloadUntilElementsLoaded(
      "pipeline-list-row",
      () => {
        cy.findByTestId("pipeline-list").should("exist");
        return cy.findByTestId("loading-table-row").should("not.exist");
      },
      2
    );
  });

  it("creates a pipeline, edits the path", () => {
    cy.intercept("PUT", /.*/).as("allPuts");
    cy.createPipeline(SAMPLE_PIPELINE_NAMES.PL1);

    // a known issue of Cypress; however the workaround doesn't always work
    // https://docs.cypress.io/api/commands/hover#Workarounds
    // cy.findByTestId("pipeline-path").trigger("mouseover");
    // cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH).should("be.visible");

    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH).click({ force: true });
    let path = `my-super-test.orchest`;
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_TEXTFIELD)
      .should("be.visible")
      .type("{selectall}{backspace}")
      .type(path);
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_SAVE).click();
    cy.wait("@allPuts");
    cy.readFile(`${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}/${path}`);
  });

  it("creates a pipeline, edits the path to be a directory that does not exist", () => {
    cy.intercept("PUT", /.*/).as("allPuts");
    let path = `/a/b/c/my-super-test.orchest`;
    cy.createPipeline(SAMPLE_PIPELINE_NAMES.PL1);
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH).click({ force: true });
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_TEXTFIELD)
      .should("be.visible")
      .type("{selectall}{backspace}")
      .type(path);
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_SAVE).click();
    cy.wait("@allPuts");
    cy.readFile(`${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}/${path}`);
  });

  pathTestCases.forEach((input) => {
    it(`tests pipelines create path normalization (${input[0]} to ${input[1]})`, () => {
      cy.createPipeline(SAMPLE_PIPELINE_NAMES.PL1, input[0] + ".orchest");
      cy.readFile(
        `${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}/${input[1]}.orchest`
      );
    });

    it(`tests pipelines path edit normalization (${input[0]} to ${input[1]})`, () => {
      cy.intercept("PUT", /.*/).as("allPuts");
      cy.createPipeline(SAMPLE_PIPELINE_NAMES.PL1);
      cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH).click({ force: true });
      cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_TEXTFIELD)
        .should("be.visible")
        .type("{selectall}{backspace}")
        .type(input[0] + ".orchest");
      cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_SAVE).click();
      cy.wait("@allPuts");
      cy.readFile(
        `${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}/${input[1]}.orchest`
      );
    });
  });

  context("requires an environment image to be available", () => {
    beforeEach(() => {
      cy.createPipeline(SAMPLE_PIPELINE_NAMES.PL1);
      assertEnvIsBuilt();
      cy.navigateViaTopMenu("pipeline");
    });

    it("opens the pipeline editor, ", () => {
      cy.findByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();
      cy.findByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).should("be.visible");
    });

    it("stops the session and restarts it, ", () => {
      cy.findByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();

      // Expect a running session.
      cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).contains(
        "Stop session",
        { timeout: 60000 }
      );
      cy.findAllByTestId(TEST_ID.SWITCH_TO_JUPYTERLAB)
        .should("be.visible")
        .should("be.enabled");
      cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).click();

      // Expect a stopped session.
      cy.findAllByTestId(
        TEST_ID.SESSION_TOGGLE_BUTTON
      ).contains("Start session", { timeout: 60000 });

      // JupyterLab can be opened at any time (if no session
      // is present the JupyterLab page will start it)
      cy.findAllByTestId(TEST_ID.SWITCH_TO_JUPYTERLAB)
        .should("be.visible")
        .should("be.enabled");

      cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).click();
      // Expect a running session again.
      cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).contains(
        "Stop session",
        { timeout: 60000 }
      );
      cy.findAllByTestId(TEST_ID.SWITCH_TO_JUPYTERLAB)
        .should("be.visible")
        .should("be.enabled");
    });

    it("creates a step, default file name", () => {
      cy.findByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();
      cy.createStep(SAMPLE_STEP_NAMES.ST1, true);
      cy.readFile(
        `${PROJECTS_DIR}/${
          SAMPLE_PROJECT_NAMES.P1
        }/${SAMPLE_STEP_NAMES.ST1.replaceAll("-", "_")}.ipynb`
      );
    });

    it("creates a step, modifies the file name", () => {
      cy.findByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();
      cy.createStep(SAMPLE_STEP_NAMES.ST1, true, "my_test");
      let fileName = "my_test";
      cy.readFile(
        `${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}/${fileName}.ipynb`
      );
    });

    pathTestCases.forEach((input) => {
      it(`tests step file creation path normalization (${input[0]} to ${input[1]})`, () => {
        cy.findByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();
        cy.createStep(input[0], true, input[1]);
        cy.readFile(
          `${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}/${input[1]}.ipynb`
        );
      });
    });

    context("requires a running session", () => {
      beforeEach(() => {
        cy.findByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();
        // Expect a running session.
        cy.findAllByTestId(
          TEST_ID.SESSION_TOGGLE_BUTTON
        ).contains("Stop session", { timeout: 60000 });
      });

      it("tests getting into Jupyterlab", () => {
        cy.findByTestId(TEST_ID.SWITCH_TO_JUPYTERLAB).click();
        waitForJupyterlab();
      });

      it("tests opening a step in Jupyterlab", () => {
        cy.createStep(SAMPLE_STEP_NAMES.ST1, true);
        // Assumes unique step names.
        cy.intercept("POST", /async\/project-files\/exists/).as("fileExists");
        cy.get(`[data-test-title=${SAMPLE_STEP_NAMES.ST1}]`)
          .scrollIntoView()
          .click({ force: true });
        cy.wait("@fileExists");
        cy.findByTestId(TEST_ID.STEP_VIEW_IN_JUPYTERLAB)
          .should("not.be.disabled")
          .pipe(piped_click);
        waitForJupyterlab();
      });
    });
  });
});
