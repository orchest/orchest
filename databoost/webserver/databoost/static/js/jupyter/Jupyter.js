class Jupyter {

    constructor(jupyterHolderJEl) {
        this.jupyterHolder = jupyterHolderJEl;
        this.iframe = undefined;

        this.initializeJupyter();

        // TODO: change setJupyterAddress non-hardcoded
        this.baseAddress = "http://172.18.0.3:8888/";
        this.token = "&token=0d304625c25fc969620f6cdd5d6a9bec34a454e614848e2c";
        this.setJupyterAddress(this.baseAddress + "lab/workspaces/main?reset" + this.token);
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
        this.setJupyterAddress(this.baseAddress + "lab/workspaces/main/tree/" + filePath + "?" + this.token);
    }

    initializeJupyter(){

        this.iframe = document.createElement("iframe");
        $(this.iframe).attr("width", "100%");
        $(this.iframe).attr("height", "100%");

        this.jupyterHolder.append(this.iframe);
    }

}

export default Jupyter