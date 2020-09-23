class Jupyter {

    constructor(jupyterHolderJEl) {
        this.jupyterHolder = jupyterHolderJEl;
        this.iframe = undefined;

        this.initializeJupyter();

        // TODO: change setJupyterAddress non-hardcoded
        this.baseAddress = "";
        this.token = "";

        this.reloadOnShow = false;
    }

    updateJupyterInstance(baseAddress, token){
        this.baseAddress = baseAddress;
        this.token = token;
    }

    show(){
        this.jupyterHolder.removeClass("hidden");

        if(this.reloadOnShow){
            this.reloadOnShow = false;
            this._reloadFilesFromDisk();
        }
    }
    hide(){
        this.jupyterHolder.addClass("hidden");
    }

    setJupyterAddress(url){
        this.iframe.src = url;
    }

    reloadFilesFromDisk(){
        this.reloadOnShow = true;
    }

    _reloadFilesFromDisk(){
        if(this.iframe.contentWindow._orchest_app){
            
            this.reloadOnShow = false;

            let lab = this.iframe.contentWindow._orchest_app;
            let docManager = this.iframe.contentWindow._orchest_docmanager;
    
            let citer = lab.shell.widgets("main");
    
            while(true){
                let widget = citer.next();
                if(widget === undefined){
                    break;
                }

                // Refresh active NotebookPanel widgets
                // if users has unsaved state, don't reload file from disk
                if(widget.constructor.name == "NotebookPanel" && !widget.model.dirty){
                    // for each widget revert if not dirty
                    let ctx = docManager.contextForWidget(widget);
    
                    // ctx is undefined when widgets are closed
                    // although widgets("main") seems to only return active widgets
                    if(ctx !== undefined){
                        ctx.revert();
                    }
                }
            }
        }
    }

    navigateTo(filePath){
        if(this.iframe.src.indexOf(this.baseAddress) !== -1){
            this.iframe.contentWindow._orchest_docmanager.openOrReveal(filePath);
        }else{
            this.setJupyterAddress(this.baseAddress + "lab/workspaces/main/tree/" + filePath + "?token=" + this.token);
        }
    }

    initializeJupyter(){

        this.iframe = document.createElement("iframe");
        $(this.iframe).attr("width", "100%");
        $(this.iframe).attr("height", "100%");

        this.jupyterHolder.append(this.iframe);
    }

}

export default Jupyter