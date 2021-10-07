#!/usr/bin/env bash
set -e

NODE_MODULES_PATH=node_modules
BIN_PATH=$(pwd)/node_modules/.bin
PATH=$BIN_PATH:$PATH

function index_template_fill() {
    # Template transform index.html
    JS_PATH="{{JS_PATH}}"
    CSS_PATH="{{CSS_PATH}}"
    JS_FILE_NAME="\/$1"
    CSS_FILE_NAME="\/$2"

    cat public/index.html | sed "s/$JS_PATH/$JS_FILE_NAME/g" \
    | sed "s/$CSS_PATH/$CSS_FILE_NAME/g" > dist/index.html
}

WATCH=false
while getopts ":-:" opt; do
  case ${opt} in
    -)
      if [ $OPTARG == "watch" ]; then
          WATCH=true
      fi
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      ;;
  esac
done

# Copy everything to dist directory
rm -rf dist/ || true
mkdir dist/
cp -r public/ dist/

JS_BUNDLE_PATH="dist/main.js"
CSS_BUNDLE_PATH="dist/style.css"

ESBUILD_ARGS="src/main.tsx --bundle --minify --sourcemap --target=es6 --outfile=$JS_BUNDLE_PATH"
SASS_ARGS="--load-path=$NODE_MODULES_PATH src/styles/main.scss $CSS_BUNDLE_PATH"

if $WATCH; then
    index_template_fill "main.js" "style.css"
    esbuild $ESBUILD_ARGS --watch &
    sass $SASS_ARGS --watch
else

    esbuild $ESBUILD_ARGS &
    sass $SASS_ARGS

    wait $(jobs -p)

    JS_BUNDLE_HASH=$(md5sum $JS_BUNDLE_PATH | cut -d ' ' -f 1)
    CSS_BUNDLE_HASH=$(md5sum $CSS_BUNDLE_PATH | cut -d ' ' -f 1)

    JS_FILE_NAME="main-$JS_BUNDLE_HASH.js"
    CSS_FILE_NAME="main-$CSS_BUNDLE_HASH.css"

    # Maps are options
    mv $JS_BUNDLE_PATH dist/$JS_FILE_NAME
    mv $JS_BUNDLE_PATH.map dist/$JS_FILE_NAME.map
    mv $CSS_BUNDLE_PATH dist/$CSS_FILE_NAME
    mv $CSS_BUNDLE_PATH.map dist/$CSS_FILE_NAME.map

    index_template_fill "$JS_FILE_NAME" "$CSS_FILE_NAME"
fi
