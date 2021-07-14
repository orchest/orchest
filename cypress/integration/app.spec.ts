describe("app", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("renders", () => {
    cy.findByTestId("root")
      .should("exist")
      .and("be.visible")
      .within(() => {
        cy.findByTestId("app").should("exist").and("be.visible");
      });
  });
});
