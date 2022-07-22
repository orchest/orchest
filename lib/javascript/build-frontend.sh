#!/usr/bin/env bash
set -e

NODE_MODULES_PATH=node_modules
BIN_PATH="$(npm bin)"
PATH="$BIN_PATH:$PATH"
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"


function index_template_fill() {
  # Template transform index.html
  JS_PATH_PLACEHOLDER="{{JS_PATH}}"
  CSS_BLOCK_PLACEHOLDER="{{CSS_BLOCK}}"
  JS_HASH_PLACEHOLDER="{{JS_HASH}}"
  JS_FILE_NAME="$1"
  CSS_FILE_NAME="$2"

  CSS_BLOCK_FILE="dist/css-block.html"

  if [ $3 == "inject-css" ]; then
    echo "<style>$(cat ${CSS_FILE_NAME})</style>" > $CSS_BLOCK_FILE
  else
    echo "<link href=\"${CSS_FILE_NAME}\" rel=\"stylesheet\" />" > $CSS_BLOCK_FILE
  fi
  
  # Replace JS_FILE
  RES=$($DIR/replace.py public/index.html "$JS_PATH_PLACEHOLDER" "$JS_FILE_NAME")
  echo "$RES" > dist/index.html
  # Replace JS_HASH
  RES=$($DIR/replace.py dist/index.html "$JS_HASH_PLACEHOLDER" "$JS_FILE_NAME")
  echo "$RES" > dist/index.html
  # Replace CSS_BLOCK
  RES=$($DIR/replace.py dist/index.html "$CSS_BLOCK_PLACEHOLDER" "$CSS_BLOCK_FILE" file)
  echo "$RES" > dist/index.html

  # Cleanup
  rm $CSS_BLOCK_FILE
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
mkdir -p dist/
rm -r dist
cp -R public/ dist/

JS_BUNDLE_PATH="dist/main.js"
CSS_BUNDLE_PATH="dist/style.css"

TS_SRC_PATH="src/main.tsx"
SASS_SRC_PATH="src/styles/main.scss"

ESBUILD_ARGS="$TS_SRC_PATH --bundle --target=es6 --sourcemap --tsconfig=tsconfig.build.json --define:__BASE_URL__=\"\" --outfile=$JS_BUNDLE_PATH"
SASS_ARGS="$SASS_SRC_PATH --load-path=$NODE_MODULES_PATH $CSS_BUNDLE_PATH"

if $WATCH; then
  echo "Running in watch mode..."
  DATE_UNIX=$(date +%s)
  DEBUG_JS_FILENAME="main.js?hash=${DATE_UNIX}"
  DEBUG_CSS_FILENAME="style.css?hash=${DATE_UNIX}"
  index_template_fill $DEBUG_JS_FILENAME $DEBUG_CSS_FILENAME "watch"
  sass $SASS_ARGS --watch &
  NODE_ENV=development esbuild $ESBUILD_ARGS --watch
else
  sass $SASS_ARGS && echo "Compiled $SASS_SRC_PATH successfully!" &
  esbuild $ESBUILD_ARGS --minify

  wait $(jobs -p)

  md5_hash_command="md5sum"
  if ! command -v $md5_hash_command &> /dev/null
  then
    md5_hash_command="md5 -r"
  fi

  JS_BUNDLE_HASH=$($md5_hash_command $JS_BUNDLE_PATH | cut -d ' ' -f 1)

  JS_FILE_NAME="main.js?hash=$JS_BUNDLE_HASH"

  index_template_fill "$JS_FILE_NAME" "$CSS_BUNDLE_PATH" "inject-css"
fi
