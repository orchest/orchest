describe("navigation", () => {
  context("menu bar", () => {
    // TBC
    // it("should go the default view on logo click", () => {});

    context("in pipeline view", () => {
      context("regardless of read_only", () => {
        it("should show the pipeline name", () => {});
        it("should show the save indicator", () => {});
      });

      context("when read_only", () => {
        it("should toggle the session", () => {});
        it("should toggle the jupyterlab/pipeline view", () => {});
      });
    });

    context("in any view", () => {
      it("should logout", () => {});
      it("should go to the help view", () => {});
    });
  });

  context("project selector", () => {
    context("in any view", () => {
      it("should change project when selected", () => {
        // should stay in state after refresh
      });
    });

    context("in no-op views", () => {
      it("should not be visible", () => {
        // should stay in state after refresh
      });
    });

    context("in op views", () => {
      it("should be visible", () => {
        // should stay in state after refresh
      });
    });
  });

  context("drawer", () => {
    context("visibility", () => {
      it("should be open on first load", () => {});

      it("should toggle", () => {
        // Should stay in state after refresh
      });
    });

    context("links", () => {
      //  Should match url (href and browser url)
      //  Should have `aria-selected="true"`
      //  Should stay selected on reload
      //  Should still apply if drawer is closed/open
      it("should show selected item on first load", () => {});
      it("should visit selected item", () => {});
    });
  });
});
