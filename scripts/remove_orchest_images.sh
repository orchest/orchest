#!/bin/bash

docker rmi $(docker images |grep 'orchest')