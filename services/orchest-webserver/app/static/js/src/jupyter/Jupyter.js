class Jupyter {
  constructor(jupyterHolderJEl) {
    this.jupyterHolder = jupyterHolderJEl;
    this.iframe = undefined;
    this.baseAddress = "";
    this.reloadOnShow = false;

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
      this.setJupyterAddress(this.baseAddress);
    }
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
    if (this.iframe.contentWindow._orchest_app) {
      this.reloadOnShow = false;

      let lab = this.iframe.contentWindow._orchest_app;
      let docManager = this.iframe.contentWindow._orchest_docmanager;

      let citer = lab.shell.widgets("main");

      while (true) {
        let widget = citer.next();
        if (widget === undefined) {
          break;
        }

        // Refresh active NotebookPanel widgets
        // if users has unsaved state, don't reload file from disk
        if (widget.constructor.name == "NotebookPanel" && !widget.model.dirty) {
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

  navigateTo(filePath) {
    if (!filePath) {
      return;
    }
    if (
      this.iframe.contentWindow.location.href.indexOf(this.baseAddress) !==
        -1 &&
      this.iframe.contentWindow._orchest_docmanager !== undefined
    ) {
      this.iframe.contentWindow._orchest_docmanager.openOrReveal(filePath);
    } else {
      this.setJupyterAddress(
        this.baseAddress +
          "/lab/workspaces/main/tree/" +
          encodeURIComponent(filePath) +
          "?reset"
      );
    }
  }

  initializeJupyter() {
    this.iframe = document.createElement("iframe");
    $(this.iframe).attr("width", "100%");
    $(this.iframe).attr("height", "100%");

    this.jupyterHolder.append(this.iframe);
  }
}

export default Jupyter;
