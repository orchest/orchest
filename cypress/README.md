# Integration Tests

We use Cypress to run end-to-end tests.

## Tips

- run `cy.reload()` after `cy.exec`. The reason is that the client-side React app will cache the latest response from the backend of `orchest-webserver`. The backend changes is not yet updated to the client-side.

- use assertion instead of `cy.wait`.
