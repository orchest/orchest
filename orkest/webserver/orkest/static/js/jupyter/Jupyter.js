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
        this.jupyterHolder.addClass("hidden");
    }

    setJupyterAddress(url){
        this.iframe.src = url;
    }

    navigateTo(filePath){
        this.setJupyterAddress(this.baseAddress + "lab/workspaces/main/tree/" + filePath + "?token=" + this.token);
    }

    initializeJupyter(){

        this.iframe = document.createElement("iframe");
        $(this.iframe).attr("width", "100%");
        $(this.iframe).attr("height", "100%");

        this.jupyterHolder.append(this.iframe);
    }

}

export default Jupyter