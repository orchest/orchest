#!/bin/bash

# node-sass doesn't build a first time with --watch
npm run build-sass
npm run build-sass -- --watch