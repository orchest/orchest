import { tryUntilTrue } from "../utils/webserver-utils";

class Jupyter {
  jupyterHolder: any;
  iframe: any;
  baseAddress: string;
  reloadOnShow: boolean;
  pendingKernelChanges: any;

  constructor(jupyterHolderJEl) {
    // @ts-ignore
    this.jupyterHolder = $(jupyterHolderJEl);
    this.iframe = undefined;
    this.baseAddress = "";
    this.reloadOnShow = false;
    this.pendingKernelChanges = {};

    this.initializeJupyter();
  }

  updateJupyterInstance(baseAddress) {
    if (this.baseAddress != baseAddress) {
      // when a new baseAddress is set, unload iframe since it is no longer valid
      this.unload();
    }

    this.baseAddress = baseAddress;
  }

  show() {
    // this method should only be called directly from main.js
    this.jupyterHolder.removeClass("hidden");

    if (this.reloadOnShow) {
      this.reloadOnShow = false;
      this._reloadFilesFromDisk();
    }

    // make sure the baseAddress has loaded
    if (
      this.iframe.contentWindow.location.href.indexOf(this.baseAddress) === -1
    ) {
      this.setJupyterAddress(this.baseAddress + "/lab");
    }

    this.fixJupyterRenderingGlitch();
  }

  hide() {
    this.jupyterHolder.addClass("hidden");
  }

  unload() {
    this.iframe.contentWindow.location.replace("about:blank");
  }

  setJupyterAddress(url) {
    this.iframe.contentWindow.location.replace(url);
  }

  reloadFilesFromDisk() {
    this.reloadOnShow = true;
  }

  _reloadFilesFromDisk() {
    // @ts-ignore
    if (this.iframe.contentWindow._orchest_app) {
      this.reloadOnShow = false;

      // @ts-ignore
      let lab = this.iframe.contentWindow._orchest_app;
      // @ts-ignore
      let docManager = this.iframe.contentWindow._orchest_docmanager;

      let citer = lab.shell.widgets("main");

      let widget;
      while ((widget = citer.next())) {
        // Refresh active NotebookPanel widgets
        // if users has unsaved state, don't reload file from disk
        if (
          widget.node &&
          widget.node.classList.contains("jp-NotebookPanel") &&
          !widget.model.dirty
        ) {
          // for each widget revert if not dirty
          let ctx = docManager.contextForWidget(widget);

          // ctx is undefined when widgets are closed
          // although widgets("main") seems to only return active widgets
          if (ctx !== undefined) {
            ctx.revert();
          }
        }
      }
    }
  }

  isJupyterLoaded() {
    try {
      // @ts-ignore
      let widgets = this.iframe.contentWindow._orchest_app.shell.widgets();

      // a widget is on screen
      let widgetOnScreen = false;
      let widget;
      while ((widget = widgets.next())) {
        if (widget.node.offsetParent !== null) {
          widgetOnScreen = true;
          break;
        }
      }
      return (
        // @ts-ignore
        this.iframe.contentWindow._orchest_app !== undefined && widgetOnScreen
      );
    } catch {
      return false;
    }
  }

  isJupyterShellRenderedCorrectly() {
    try {
      return (
        // @ts-ignore
        this.iframe.contentWindow._orchest_app.shell.node.querySelector(
          "#jp-main-content-panel"
        ).clientWidth ===
          // @ts-ignore
          this.iframe.contentWindow._orchest_app.shell.node.clientWidth ||
        // @ts-ignore
        this.iframe.contentWindow._orchest_app.shell.node.querySelector(
          "#jp-main-content-panel"
        ).clientWidth > 500
      );
    } catch {
      return false;
    }
  }

  fixJupyterRenderingGlitch() {
    if (this.isJupyterLoaded() && !this.isJupyterShellRenderedCorrectly()) {
      this.iframe.contentWindow.location.reload();
    }
  }

  isKernelChangePending(notebook, kernel) {
    return this.pendingKernelChanges[`${notebook}-${kernel}`] === true;
  }

  setKernelChangePending(notebook, kernel, value) {
    this.pendingKernelChanges[`${notebook}-${kernel}`] = value;
  }

  setNotebookKernel(notebook, kernel) {
    /**
     *   @param {string} notebook relative path to the Jupyter file from the
     *   perspective of the root of the project directory.
     *   E.g. somedir/myipynb.ipynb (no starting slash)
     *   @param {string} kernel name of the kernel (orchest-kernel-<uuid>)
     */

    let warningMessage =
      "Do you want to change the active kernel of the opened " +
      "Notebook? \n\nYou will lose the current kernel's state if no other Notebook " +
      "is attached to it.";

    // @ts-ignore
    if (this.iframe.contentWindow._orchest_app) {
      // @ts-ignore
      let docManager = this.iframe.contentWindow._orchest_docmanager;

      let notebookWidget = docManager.findWidget(notebook);
      if (notebookWidget) {
        let sessionContext = notebookWidget.context.sessionContext;
        if (
          sessionContext &&
          sessionContext.session &&
          sessionContext.session.kernel
        ) {
          if (sessionContext.session.kernel.name !== kernel) {
            if (!this.isKernelChangePending(notebook, kernel)) {
              this.setKernelChangePending(notebook, kernel, true);
              // @ts-ignore
              orchest.confirm("Warning", warningMessage, () => {
                sessionContext
                  .changeKernel({ name: kernel })
                  .then(() => {
                    this.setKernelChangePending(notebook, kernel, false);
                  })
                  .catch((error) => {
                    this.setKernelChangePending(notebook, kernel, false);
                    console.error(error);
                  });
              });
            }
          }
        }
      } else {
        docManager.services.sessions
          .findByPath(notebook)
          .then((notebookSession) => {
            if (notebookSession && notebookSession.kernel) {
              if (notebookSession.kernel.name !== kernel) {
                if (!this.isKernelChangePending(notebook, kernel)) {
                  this.setKernelChangePending(notebook, kernel, true);
                  // @ts-ignore
                  orchest.confirm("Warning", warningMessage, () => {
                    docManager.services.sessions
                      .shutdown(notebookSession.id)
                      .then(() => {
                        this.setKernelChangePending(notebook, kernel, false);
                      })
                      .catch((error) => {
                        this.setKernelChangePending(notebook, kernel, false);
                        console.error(error);
                      });
                  });
                }
              }
            }
          })
          .catch((error) => {
            console.error(error);
          });
      }
    }
  }

  navigateTo(filePath) {
    /**
     *   @param {string} filePath relative path to the Jupyter file from the
     *   perspective of the root of the project directory.
     *   E.g. somedir/myipynb.ipynb (no starting slash)
     */

    if (!filePath) {
      return;
    }

    tryUntilTrue(
      () => {
        if (this.isJupyterShellRenderedCorrectly() && this.isJupyterLoaded()) {
          try {
            // @ts-ignore
            this.iframe.contentWindow._orchest_docmanager.openOrReveal(
              filePath
            );
            return (
              // @ts-ignore
              this.iframe.contentWindow._orchest_docmanager.findWidget(
                filePath
              ) !== undefined
            );
          } catch (err) {
            // fail silently
            return false;
          }
        } else {
          return false;
        }
      },
      100,
      250
    );
  }

  initializeJupyter() {
    this.iframe = document.createElement("iframe");

    // @ts-ignore
    $(this.iframe).attr("width", "100%");
    // @ts-ignore
    $(this.iframe).attr("height", "100%");

    this.jupyterHolder.append(this.iframe);
  }
}

export default Jupyter;
