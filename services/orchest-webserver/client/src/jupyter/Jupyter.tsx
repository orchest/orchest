import { ConfirmDispatcher } from "@/contexts/AppContext";
import { tryUntilTrue } from "@/utils/webserver-utils";
import $ from "jquery";

// This is to enable using hotkeys to open CommandPalette.
// Proxy all the keydown events in the iframe to the hosting document object.
const passKeyboardEvent = (event: KeyboardEvent) => {
  // Intercept Ctrl/Cmd + k. It's a reserved combination in Firefox
  // https://support.mozilla.org/en-US/kb/keyboard-shortcuts-perform-firefox-tasks-quickly
  if (
    !event.altKey &&
    !event.shiftKey &&
    (event.ctrlKey || event.metaKey) &&
    event.key === "k"
  ) {
    event.preventDefault();
    event.stopPropagation();
  }

  const keyboardEvent = new KeyboardEvent(event.type, {
    key: event.key,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
  });
  document.dispatchEvent(keyboardEvent);
};

class Jupyter {
  jupyterHolder: JQuery<HTMLElement>;
  iframe: HTMLIFrameElement | undefined;
  baseAddress: string;
  reloadOnShow: boolean;
  showCheckInterval: number;
  pendingKernelChanges: Record<string, boolean>;
  iframeHasLoaded: boolean;
  setConfirm: ConfirmDispatcher;

  constructor(jupyterHolderJEl: HTMLElement, setConfirm: ConfirmDispatcher) {
    this.jupyterHolder = $(jupyterHolderJEl);
    this.iframe = undefined;
    this.baseAddress = "";
    this.reloadOnShow = false;
    this.iframeHasLoaded = false;
    this.showCheckInterval = 0;
    this.pendingKernelChanges = {};
    this.setConfirm = setConfirm;

    this.initializeJupyter();
  }

  updateJupyterInstance(baseAddress: string) {
    if (this.baseAddress != baseAddress) {
      // when a new baseAddress is set, unload iframe since it is no longer valid
      this.unload();
    }

    this.baseAddress = baseAddress;
  }

  _unhide() {
    // this method should only be called directly from main.js
    this.jupyterHolder.removeClass("hidden");
    this.iframe?.contentWindow?.document?.addEventListener(
      "keydown",
      passKeyboardEvent
    );
  }

  show() {
    if (this.reloadOnShow) {
      this.reloadOnShow = false;
      this._reloadFilesFromDisk();
    }

    // make sure the baseAddress has loaded

    if (!this.iframe?.contentWindow?.location.href.includes(this.baseAddress)) {
      this._setJupyterAddress(this.baseAddress + "/lab");
    }

    window.clearInterval(this.showCheckInterval);
    this.showCheckInterval = window.setInterval(() => {
      if (this.iframeHasLoaded) {
        if (this.hasJupyterRenderingGlitched()) {
          console.log("Reloading iframe because JupyterLab failed to render");
          this.reloadIframe();
        } else if (!this.isJupyterPage()) {
          console.log(
            "Reloading iframe page because JupyterLab page not loaded (4XX or 5XX)"
          );
          this.reloadIframe();
        } else {
          this._unhide();
          window.clearInterval(this.showCheckInterval);
        }
      }
    }, 10);
  }

  isShowing() {
    return (
      this.isJupyterPage() &&
      this.isJupyterLoaded() &&
      !this.jupyterHolder.hasClass("hidden")
    );
  }

  hide() {
    this.jupyterHolder.addClass("hidden");
    window.clearInterval(this.showCheckInterval);
    this.iframe?.contentWindow?.document?.removeEventListener(
      "keydown",
      passKeyboardEvent
    );
  }

  unload() {
    this._setJupyterAddress("about:blank");
  }

  _setJupyterAddress(url: string) {
    this.iframeHasLoaded = false;
    this.iframe?.contentWindow?.location.replace(url);
  }

  reloadFilesFromDisk() {
    this.reloadOnShow = true;
  }

  _reloadFilesFromDisk() {
    if (this.iframe?.contentWindow?._orchest_app) {
      this.reloadOnShow = false;

      let lab = this.iframe?.contentWindow?._orchest_app;
      let docManager = this.iframe?.contentWindow?._orchest_docmanager;

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

  isJupyterPage() {
    try {
      if (
        this.iframe?.contentWindow?.document.getElementById(
          "jupyter-config-data"
        )
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }

  isJupyterLoaded() {
    try {
      let widgets = this.iframe?.contentWindow?._orchest_app.shell.widgets();

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
        this.iframe?.contentWindow?._orchest_app !== undefined && widgetOnScreen
      );
    } catch {
      return false;
    }
  }

  isJupyterShellRenderedCorrectly() {
    try {
      return (
        this.iframe?.contentWindow?._orchest_app.shell.node.querySelector(
          "#jp-main-content-panel"
        ).clientWidth ===
          this.iframe?.contentWindow?._orchest_app.shell.node.clientWidth ||
        this.iframe?.contentWindow?._orchest_app.shell.node.querySelector(
          "#jp-main-content-panel"
        ).clientWidth > 500
      );
    } catch {
      return false;
    }
  }

  hasJupyterRenderingGlitched() {
    return this.isJupyterLoaded() && !this.isJupyterShellRenderedCorrectly();
  }

  reloadIframe() {
    this.iframeHasLoaded = false;
    this.iframe?.contentWindow?.location.reload();
  }

  isKernelChangePending(notebook: string, kernel: string) {
    return this.pendingKernelChanges[`${notebook}-${kernel}`];
  }

  setKernelChangePending(notebook: string, kernel: string, value: boolean) {
    this.pendingKernelChanges[`${notebook}-${kernel}`] = value;
  }

  setNotebookKernel(notebook: string, kernel: string) {
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

    if (this.iframe?.contentWindow?._orchest_app) {
      let docManager = this.iframe?.contentWindow?._orchest_docmanager;

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
              this.setConfirm("Warning", warningMessage, async (resolve) => {
                try {
                  sessionContext.changeKernel({ name: kernel }).then(() => {
                    this.setKernelChangePending(notebook, kernel, false);
                  });
                  resolve(true);
                  return true;
                } catch (error) {
                  this.setKernelChangePending(notebook, kernel, false);
                  resolve(false);
                  console.error(error);
                  return false;
                }
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
                  this.setConfirm(
                    "Warning",
                    warningMessage,
                    async (resolve) => {
                      try {
                        docManager.services.sessions
                          .shutdown(notebookSession.id)
                          .then(() => {
                            this.setKernelChangePending(
                              notebook,
                              kernel,
                              false
                            );
                          });
                        resolve(true);
                        return true;
                      } catch (error) {
                        this.setKernelChangePending(notebook, kernel, false);
                        resolve(false);
                        console.error(error);
                        return false;
                      }
                    }
                  );
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

  navigateTo(filePath: string) {
    /**
     *   @param {string} filePath relative path to the Jupyter file from the
     *   perspective of the root of the project directory.
     *   E.g. somedir/myipynb.ipynb (no starting slash)
     */

    if (!filePath) return;

    tryUntilTrue(
      () => {
        if (this.isJupyterShellRenderedCorrectly() && this.isJupyterLoaded()) {
          try {
            this.iframe?.contentWindow?._orchest_docmanager.openOrReveal(
              filePath
            );
            return (
              this.iframe?.contentWindow?._orchest_docmanager.findWidget(
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

  _loadIframe() {
    this.iframeHasLoaded = true;
  }

  initializeJupyter() {
    this.iframe = document.createElement("iframe");
    this.iframeHasLoaded = false;
    this.iframe.onload = this._loadIframe.bind(this);

    $(this.iframe).attr("width", "100%");
    $(this.iframe).attr("height", "100%");
    $(this.iframe).attr("data-test-id", "jupyterlab-iframe");

    const expandToFullScreenInterval = window.setInterval(() => {
      const width = this.iframe?.getAttribute("width");
      const height = this.iframe?.getAttribute("height");

      if (this.iframe && (width !== "100%" || height !== "100%")) {
        this.iframe?.setAttribute("width", "100%");
        this.iframe?.setAttribute("height", "100%");
        return;
      }
      window.clearInterval(expandToFullScreenInterval);
    }, 10);

    this.jupyterHolder.append(this.iframe);
  }
}

export default Jupyter;
