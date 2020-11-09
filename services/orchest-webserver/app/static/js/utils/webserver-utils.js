import { makeRequest } from "../lib/utils/all";
import EnvironmentsView from "../views/EnvironmentsView";

export function checkGate(project_uuid){
    return new Promise((resolve, reject) => {
        makeRequest("POST", "/catch/api-proxy/api/check/gate/", {type: 'json', content: {"project_uuid": project_uuid}}).then((response) => {
            try {
                let json = JSON.parse(response);
                if(json.gate === true){
                    resolve();
                }else{
                    reject({reason: 'missing-environments', data: json})
                }
            } catch(error){
                console.error(error);
            }
        }).catch((error) => {
            reject({reason: 'request-failed', error: error});
        });
    });
}

export function requestBuild(project_uuid, gateData){
    return new Promise((resolve, reject) => {

        let missingEnvironments = gateData.missing_environment_uuids;
        let buildingEnvironments = gateData.building_environment_uuids;
        let environmentsToBeBuilt = missingEnvironments.filter(x => !buildingEnvironments.includes(x));
        
        if(environmentsToBeBuilt.length > 0){
            orchest.confirm(
                "Build",
                `The following environment UUIDs haven't been built: [${environmentsToBeBuilt}]. Would you like to build them?`,
                () => {
                    
                    let environment_build_requests = [];

                    for(let environmentUUID of environmentsToBeBuilt){
                        environment_build_requests.push({
                            "environment_uuid": environmentUUID,
                            "project_uuid": project_uuid,
                        });
                    }

                    makeRequest("POST", "/catch/api-proxy/api/environment_builds", {
                        type: "json",
                        content: {
                            "environment_build_requests": environment_build_requests
                        },
                    })
                    .then((_) => {
                    })
                    .catch((error) => {
                        console.log(error);
                    });

                    // show environments view
                    orchest.loadView(EnvironmentsView, {project_uuid: project_uuid});
                    
                    resolve();
                },
                () => {
                    reject();
                }
            )
        }else{
            resolve();
        }
    })
}