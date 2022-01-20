# Integration Tests

We use Cypress to run end-to-end tests.

## Tips

- run `cy.reload()` after `cy.exec`. The reason is that the client-side React app will cache the latest response from the backend of `orchest-webserver`. The backend changes is not yet updated to the client-side.

- use assertion instead of `cy.wait`.

- when encountering "timeout, some element never appears" issue, prevent finding element by chaining `cy.get` or `cy.find`.

```javascript
// if Cypress found .foo but failed to find .bar, it won't retry querying from beginning
cy.get(".foo").find(".bar");
// this will retry the whole query
cy.get(".foo .bar");
```
