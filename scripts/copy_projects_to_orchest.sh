#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
SOURCE="${DIR}/../backups/projects"

pod_name=$(kubectl get pods -n orchest -l app.kubernetes.io/name=orchest-api \
    --field-selector=status.phase=Running --no-headers \
    --output=jsonpath={.items..metadata.name})

if [ -z "$pod_name" ]
then
    echo "Orchest needs to be running to perform this operation."
    exit 1
fi

if [ ! -d "${SOURCE}" ]
then
    echo "Didn't find ${SOURCE}, exiting."
    exit 1
fi

echo "Copying the projects directory at ${SOURCE} into Orchest."
kubectl cp "${SOURCE}" "orchest/${pod_name}:/userdir" > /dev/null