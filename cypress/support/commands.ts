import "cypress-localstorage-commands";
import "@testing-library/cypress/add-commands";

declare global {
  namespace Cypress {
    interface Chainable {
      setOnboardingCompleted(value: string): void;
      getOnboardingCompleted(): Chainable<string>;
    }
  }
}

const LOCAL_STORAGE_KEY = "orchest.onboarding_completed";

Cypress.Commands.add("setOnboardingCompleted", (value: string) => {
  cy.setLocalStorage(LOCAL_STORAGE_KEY, value);
});

Cypress.Commands.add("getOnboardingCompleted", () =>
  cy.getLocalStorage(LOCAL_STORAGE_KEY)
);

before(() => {
  cy.configureCypressTestingLibrary({ testIdAttribute: "data-test-id" });
});
