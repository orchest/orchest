#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
DESTINATION="${DIR}/../backups/data"

pod_name=$(kubectl get pods -n orchest -l app.kubernetes.io/name=orchest-api \
    --field-selector=status.phase=Running --no-headers \
    --output=jsonpath={.items..metadata.name})

if [ -z "$pod_name" ]
then
    echo "Orchest needs to be running to perform this operation."
    exit 1
fi

echo "Copying the data directory to ${DESTINATION}"
kubectl cp "orchest/${pod_name}:/userdir/data" "$DESTINATION" > /dev/null