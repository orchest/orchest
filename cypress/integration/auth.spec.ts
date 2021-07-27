import { TEST_ID } from "../support/common";

describe("auth system", () => {
  beforeEach(() => {
    cy.setOnboardingCompleted("true");
  });

  it("can create and delete a user", () => {
    cy.createUser("admin", "test");
    cy.deleteUser("admin");
  });

  it("can create and delete multiple users", () => {
    cy.visit("/settings");
    cy.findByTestId(TEST_ID.MANAGE_USERS)
      .scrollIntoView()
      .should("be.visible")
      .click();
    let users = Array.from(Array(10).keys());
    users.map((user) => {
      cy.getIframe(TEST_ID.AUTH_ADMIN_IFRAME)
        .findByTestId(TEST_ID.NEW_USER_NAME)
        .should("be.visible")
        .type(user.toString());
      cy.getIframe(TEST_ID.AUTH_ADMIN_IFRAME)
        .findByTestId(TEST_ID.NEW_USER_PASSWORD)
        .should("be.visible")
        .type("test");
      cy.getIframe(TEST_ID.AUTH_ADMIN_IFRAME)
        .findByTestId(TEST_ID.ADD_USER)
        .should("be.visible")
        .click();
    });
    cy.reload();

    users.map((user) => {
      cy.getIframe(TEST_ID.AUTH_ADMIN_IFRAME)
        .findByTestId(`delete-user-${user}`)
        .scrollIntoView()
        .should("be.visible")
        .click();
    });

    cy.reload();
    users.map((user) => {
      cy.getIframe(TEST_ID.AUTH_ADMIN_IFRAME)
        .findByTestId(`delete-user-${user}`)
        .should("not.exist");
    });
  });
});
