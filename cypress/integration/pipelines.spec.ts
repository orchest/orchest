import { QUICKSTART_URL } from "../support/common";
import { TEST_ID, PROJECTS_DIR } from "../support/common";
enum PROJECT_NAMES {
  P1 = "test-project-1",
  P2 = "test-project-2",
}

enum PIPELINE_NAMES {
  PL1 = "test-pipeline-1",
  PL2 = "test-pipeline-2",
}

describe("pipelines", () => {
  beforeEach(() => {
    cy.setOnboardingCompleted("true");
    cy.createProject(PROJECT_NAMES.P1);
    cy.visit("/pipelines");
  });

  afterEach(() => {
    // cy.deleteAllPipelines()
    // cy.findAllByTestId(TEST_ID.PIPELINES_TABLE_ROW).should("have.length", 0);
  });

  it("creates a pipeline", () => {
    cy.createPipeline(PIPELINE_NAMES.PL1);
    let expected_file = `${PIPELINE_NAMES.PL1.replaceAll("-", "_")}.orchest`;
    cy.readFile(`${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${expected_file}`);
  });

  it("creates a pipeline, modifies the path", () => {
    let path = `my-super-test.orchest`;
    cy.createPipeline(PIPELINE_NAMES.PL1, path);
    cy.readFile(`${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${path}`);
  });

  it("creates a pipeline, modifies the path to be a directory that does not exist", () => {
    let path = `a/b/c/my-super-test.orchest`;
    cy.createPipeline(PIPELINE_NAMES.PL1, path);
    cy.readFile(`${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${path}`);
  });

  it("creates a pipeline, copies the file", () => {
    cy.createPipeline(PIPELINE_NAMES.PL1);
    let expected_file = `${PIPELINE_NAMES.PL1.replaceAll("-", "_")}.orchest`;
    // Make a copy of the file, expect Orchest to pick it up as a new
    // pipeline.
    let original_path = `${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${expected_file}`;
    let copy_path = `${PROJECTS_DIR}/${PROJECT_NAMES.P1}/copy.orchest`;
    cy.exec(`cp ${original_path} ${copy_path}`);
    cy.visit("/pipelines");
    cy.findAllByTestId(TEST_ID.PIPELINES_TABLE_ROW).should("have.length", 2);
  });

  it("deletes a pipeline through the fs", () => {
    cy.createPipeline(PIPELINE_NAMES.PL1);
    let expected_file = `${PIPELINE_NAMES.PL1.replaceAll("-", "_")}.orchest`;
    let expected_path = `${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${expected_file}`;
    // Make sure the creation went well.
    cy.readFile(expected_path);
    // Remove through the FS, expect Orchest to be aware when
    // refreshing.
    cy.exec(`rm ${expected_path}`);
    cy.visit("/pipelines");
    cy.findAllByTestId(TEST_ID.PIPELINES_TABLE_ROW).should("have.length", 0);
  });

  it("creates a pipeline, edits the path", () => {
    cy.createPipeline(PIPELINE_NAMES.PL1);
    let path = `my-super-test.orchest`;
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH).click();
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_TEXTFIELD)
      .should("be.visible")
      .type("{selectall}{backspace}")
      .type(path);
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_SAVE).click();
    cy.wait("@allPuts");
    cy.readFile(`${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${path}`);
  });

  it("creates a pipeline, edits the path to be a directory that does not exist", () => {
    let path = `/a/b/c/my-super-test.orchest`;
    cy.createPipeline(PIPELINE_NAMES.PL1);
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH).click();
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_TEXTFIELD)
      .should("be.visible")
      .type("{selectall}{backspace}")
      .type(path);
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_SAVE).click();
    cy.wait("@allPuts");
    cy.readFile(`${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${path}`);
  });

  [
    ["/a.orchest", "a.orchest"],
    ["./a.orchest", "a.orchest"],
    ["/b/c/../a.orchest", "b/a.orchest"],
    ["b/c/../a.orchest", "b/a.orchest"],
    ["b/././a.orchest", "b/a.orchest"],
  ].forEach((input) => {
    it(`tests pipelines create path normalization (${input[0]} to ${input[1]})`, () => {
      cy.createPipeline(PIPELINE_NAMES.PL1, input[0]);
      cy.readFile(`${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${input[1]}`);
    });
    it(`tests pipelines path edit normalization (${input[0]} to ${input[1]})`, () => {
      cy.createPipeline(PIPELINE_NAMES.PL1);
      cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH).click();
      cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_TEXTFIELD)
        .should("be.visible")
        .type("{selectall}{backspace}")
        .type(input[0]);
      cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_SAVE).click();
      cy.wait("@allPuts");
      cy.readFile(`${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${input[1]}`);
    });
  });
});
