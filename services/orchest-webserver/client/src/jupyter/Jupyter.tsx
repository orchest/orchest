import { ConfirmDispatcher } from "@/contexts/GlobalContext";
import { tryUntilTrue } from "@/utils/webserver-utils";
import { hasValue } from "@orchest/lib-utils";

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
  jupyterHolder: HTMLElement;
  iframe: HTMLIFrameElement | undefined;
  baseAddress: string;
  reloadOnShow: boolean;
  showCheckInterval: number;
  pendingKernelChanges: Record<string, boolean>;
  iframeHasLoaded: boolean;
  setConfirm: ConfirmDispatcher;

  constructor(jupyterHolder: HTMLElement, setConfirm: ConfirmDispatcher) {
    this.jupyterHolder = jupyterHolder;
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
    this.jupyterHolder.classList.remove("hidden");

    // Remove so we don't register twice
    this.iframe?.contentWindow?.document?.removeEventListener(
      "keydown",
      passKeyboardEvent
    );

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

    /*
      Catching glitches of <iframe> rendered JupyterLab

      There are a number of failure modes we need to take into account, and this 
      requires a complicated set of conditions to be checked at various points in time.

      First I'll describe how JupyterLab can fail to load:

      1. The endpoint serving the JupyterLab <iframe> can be down and load a 5XX error 
      HTML page. If not checked for the <iframe> will think it loaded successfully 
      (it doesn't care about what's in the iframe, or whether that HTTP GET returned 
      a non 2XX status code).

      2. JupyterLab's UI rendering requires elements to be on the screen when loading 
      UI components. Because of how we embed the <iframe> in Orchest (we leave it loaded
         in the background and CSS display:none hide it to be able to return to it 
         quickly) we don't always have the <iframe> on screen for the full duration of 
         its application load. This can lead to a glitched load of the JupyterLab app 
         and can only be detected by "introspecting" the JupyterLab UI elements and 
         checking for the sizes (this detection mechanism is brittle and might fail as 
          JupyterLab evolves, perhaps they'll evolve to avoid needing to be on screen 
          to render too, but let's not get our hopes up.)

      The basic approach below is to run a "health checker" setInterval loop when 
      JupyterLab is loaded by the application (jupyter.show() is called).

      It will keep checking the health by checking for the two failure modes above. 
      If it detects either non-recoverable failure mode it will reload the <iframe> 
      to attempt to get to a successfully loaded endstate.

      1. Can't be recovered from without a reload because the page has completed the 
      load and the error page has no retry mechanism built in.

      2. Can't be recovered from without a reload because the JupyterLab UI can't be 
      triggered to reinitialize itself without diving into 
      brittle internal/private APIs.
    */
    window.clearInterval(this.showCheckInterval);

    this.showCheckInterval = window.setInterval(() => {
      if (this.iframeHasLoaded) {
        this._unhide();

        if (this.hasRendered() && this.hasRenderingProblem()) {
          console.log("Reloading iframe because JupyterLab failed to render");

          this.reloadIframe();
        } else if (!this.hasJupyterIframe()) {
          console.log(
            "Reloading iframe page because JupyterLab page not loaded (4XX or 5XX)"
          );
          this.reloadIframe();
        } else if (this.hasJupyterIframe() && !this.hasRendered()) {
          // console.log("Still initializing page.");
          // This can run 100+ times easily, hiding
          // console.log to avoid cluttering
          // the console.
        } else {
          // Fully loaded, no errors detected, we can stop checking.
          window.clearInterval(this.showCheckInterval);
        }
      }
    }, 10);
  }

  isShowing() {
    return (
      this.hasJupyterIframe() &&
      this.hasRendered() &&
      !this.jupyterHolder.classList.contains("hidden")
    );
  }

  hide() {
    this.jupyterHolder.classList.add("hidden");
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

  getApp() {
    return this.iframe?.contentWindow?._orchest_app;
  }

  getWidgets(name?: string) {
    return this.getApp()?.shell?.widgets(name);
  }

  getDocManager() {
    return this.iframe?.contentWindow?._orchest_docmanager;
  }

  _reloadFilesFromDisk() {
    const docManager = this.getDocManager();
    const citer = this.getWidgets("main");

    if (citer && docManager) {
      this.reloadOnShow = false;

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
          const ctx = docManager.contextForWidget(widget);

          // ctx is undefined when widgets are closed
          // although widgets("main") seems to only return active widgets
          if (ctx !== undefined) {
            ctx.revert();
          }
        }
      }
    }
  }

  hasJupyterIframe() {
    return Boolean(
      this.iframe?.contentWindow?.document.getElementById("jupyter-config-data")
    );
  }

  hasLoaded() {
    return Boolean(this.getWidgets());
  }

  hasRendered() {
    const widgets = this.getWidgets();

    if (!widgets) return false;

    let widget;
    while ((widget = widgets.next())) {
      if (hasValue(widget.node.offsetParent)) {
        return true;
      }
    }

    return false;
  }

  hasRenderingProblem() {
    const shellNode = this.getApp()?.shell?.node;
    const contentPanel = shellNode?.querySelector("#jp-main-content-panel");

    if (!contentPanel) return true;

    return (
      contentPanel.clientWidth !== shellNode.clientWidth ||
      contentPanel.clientWidth <= 500
    );
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

  /**
   * @param notebook the file path relative to the project directory root.
   *  E.g. somedir/myipynb.ipynb (no starting slash)
   * @param kernel name of the kernel (orchest-kernel-<uuid>)
   */
  setNotebookKernel(notebook: string, kernel: string) {
    let warningMessage =
      "Do you want to change the active kernel of the opened " +
      "Notebook? \n\nYou will lose the current kernel's state if no other Notebook " +
      "is attached to it.";

    const docManager = this.getDocManager();

    if (this.getApp() && docManager) {
      const notebookWidget = docManager.findWidget(notebook);

      if (notebookWidget) {
        const sessionContext = notebookWidget.context.sessionContext;
        if (sessionContext?.session?.kernel) {
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

  openFile(filePath: string) {
    if (!filePath) return;

    const isFileOpen = () =>
      Boolean(this.getDocManager()?.findWidget(filePath)?.isVisible);
    const openOrRevealFile = () =>
      Boolean(this.getDocManager()?.openOrReveal(filePath)?.isVisible);

    tryUntilTrue(
      () => {
        if (this.hasRendered() && !this.hasRenderingProblem()) {
          return isFileOpen() || openOrRevealFile();
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

    this.iframe.setAttribute("width", "100%");
    this.iframe.setAttribute("height", "100%");
    this.iframe.setAttribute("data-test-id", "jupyterlab-iframe");

    this.jupyterHolder.append(this.iframe);
  }
}

export default Jupyter;
