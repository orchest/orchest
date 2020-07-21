class Jupyter {

    constructor(jupyterHolderJEl) {
        this.jupyterHolder = jupyterHolderJEl;
        this.iframe = undefined;

        this.initializeJupyter();

        // TODO: change setJupyterAddress non-hardcoded
        this.baseAddress = "";
        this.token = "";
    }

    updateJupyterInstance(baseAddress, token){
        this.baseAddress = baseAddress;
        this.token = token;
    }

    show(){
        this.jupyterHolder.removeClass("hidden");
    }
    hide(){
        // unload JupyterLab page on hide to avoid background activity
        
        this.jupyterHolder.addClass("hidden");
    }
    unload(){
        this.iframe.src = "about:blank";
    }

    setJupyterAddress(url){
        this.iframe.src = url;
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