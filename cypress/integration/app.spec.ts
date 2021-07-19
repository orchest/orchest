// @TODO
// 1. Test intercom behavior
// 2. Test telemetry
// 3. Test route changing (loadView)
// 4. Test where route is rendered
//
// misc (test usage rather than window object)
// 7. Test window.orchest

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
