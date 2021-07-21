describe("navigation", () => {
  context("menu bar", () => {
    // TBC
    // it("should go the default view on logo click", () => {});

    it("should go to the help view on help icon click", () => {});
  });

  context("project selector", () => {
    it("should be visible on op views", () => {});
    it("should not be visible on no-op views", () => {});
    it("should change project when selected", () => {
      // should stay in state after refresh
    });
  });

  context("drawer", () => {
    it("should toggled open by default", () => {});

    it("should toggle", () => {
      // Should stay in state after refresh
    });

    context("links", () => {
      //  Should match url (href and browser url)
      //  Should have `aria-selected="true"`
      //  Should stay selected on reload
      //  Should still apply if drawer is closed/open
      it("should show selected item on load", () => {});
      it("should visit selected item", () => {});
    });
  });
});
