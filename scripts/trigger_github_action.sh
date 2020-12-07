#!/bin/bash

# Create a .env file inside the dev-utils directory containining
# GITHUB_USERNAME=your-username
# GITHUB_API_KEY=your-api-key
# Generating an API key is done through:
# settings > developer settings > Personal access tokens > repo
source .env 2> /dev/null

if [[ ! $1 ]]; then
     BUILD_TAG="latest"
else
     BUILD_TAG=$1
fi

curl -X POST https://api.github.com/repos/orchest/orchest/dispatches \
     -u $GITHUB_USERNAME:$GITHUB_API_KEY \
     --data '{"event_type": "manual-trigger", "client_payload": {"build_tag": "'$BUILD_TAG'"}}'
