#!/bin/bash

# Use another Docker backend for building.
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
IMGS=()
SKIP_IMGS=()
NO_CACHE=false
VERBOSE=false
ENABLE_SSL=false
BUILD_TAG="latest"
ORCHEST_VERSION=$(git describe --tags)

# Read flags.
while getopts "s:i:t:no:ve" opt; do
  case $opt in
    e)
      # 'e' for encryption
      ENABLE_SSL=true
      ;;
    i)
      IMGS+=($OPTARG)
      ;;
    n)
      NO_CACHE=true
      echo "Cache disabled"
      ;;
    o)
      ORCHEST_VERSION="$OPTARG"
      ;;
    s)
      SKIP_IMGS+=($OPTARG)
      ;;
    t)
      BUILD_TAG="$OPTARG"
      ;;
    v)
      echo "Verbose mode. Disabling parallel building."
      VERBOSE=true
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      ;;
  esac
done

# If no images are specified, we want to build all of them.
if [ ${#IMGS[@]} -eq 0 ]; then
    IMGS=(
        "jupyter-server"
        "jupyter-enterprise-gateway"
        "celery-worker"
        "base-kernel-py"
        "base-kernel-py-gpu"
        "base-kernel-r"
        "base-kernel-julia"
        "orchest-api"
        "orchest-ctl"
        "update-server"
        "orchest-webserver"
        "nginx-proxy"
        "memory-server"
        "session-sidecar"
        "auth-server"
        "file-manager"
    )
fi

LIB_IMAGES=(
    "base-kernel-py"
    "base-kernel-py-gpu"
    "base-kernel-r"
    "base-kernel-julia"
    "orchest-ctl"
    "orchest-api"
    "orchest-webserver"
    "memory-server"
    "session-sidecar"
    "auth-server"
    "update-server"
    "celery-worker"
    "jupyter-enterprise-gateway"
)

PNPM_FILES=(
    "pnpm-lock.yaml"
    "pnpm-workspace.yaml"
    "package.json"
    "tsconfig.json"
    ".npmrc"
)

PNPM_IMAGES=(
    "orchest-webserver"
    "auth-server"
)
# TODO: add auth-server

SDK_IMAGES=(
    "base-kernel-py"
    "base-kernel-py-gpu"
    "base-kernel-r"
    "base-kernel-julia"
)

CLEANUP_BUILD_CTX=()
CLEANUP_IMAGES=()

containsElement () {
  local e match="$1"
  shift
  for e; do [[ "$e" == "$match" ]] && return 0; done
  return 1
}

run_build () {

    image=$1
    build=$2
    build_ctx=$3

    echo [Building] $image

    # copy start
    if ! [ -z "$build_ctx" ]; then

        cp $DIR/../.dockerignore $build_ctx/.dockerignore 2>/dev/null

        if containsElement "${image}" "${LIB_IMAGES[@]}" ; then
            cp -r $DIR/../lib $build_ctx/lib 2>/dev/null
        fi
        if containsElement "${image}" "${SDK_IMAGES[@]}" ; then
            cp -r $DIR/../orchest-sdk $build_ctx/orchest-sdk 2>/dev/null
        fi
        if containsElement "${image}" "${PNPM_IMAGES[@]}" ; then
            mkdir -p $build_ctx/pnpm_files
            for i in "${PNPM_FILES[@]}"
            do
                pnpm_file=${i}
                cp $DIR/../$pnpm_file $build_ctx/pnpm_files 2>/dev/null
            done
        fi
    fi
    # copy end

    if $VERBOSE; then
        ${build[@]}
    else
        output=$("${build[@]}" 2>&1)
    fi

    if [ $? = 0 ]; then
        echo [Building] $1 succeeded.
    else
        echo [Building] $1 failed.
        echo "$output"
    fi


}

function cleanup() {
    # build context clean up
    echo "Cleanup up build contexts..."
    D=0
    for i in "${CLEANUP_BUILD_CTX[@]}"
    do
        image=${CLEANUP_IMAGES[$D]}

        if ! [ -z "$i" ]; then

            # silent fail because build context can be shared and cleanup can already have happend
            if containsElement "${image}" "${LIB_IMAGES[@]}" ; then
                rm -rf $i/lib 2> /dev/null
            fi
            if containsElement "${image}" "${SDK_IMAGES[@]}" ; then
                rm -rf $i/orchest-sdk 2> /dev/null
            fi
            if containsElement "${image}" "${PNPM_IMAGES[@]}" ; then
                rm -rf $build_ctx/pnpm_files 2>/dev/null
            fi

            rm $i/.dockerignore 2> /dev/null
        fi
        D=$(expr $D + 1)
    done
}

trap cleanup SIGINT

# Build the images.
for IMG in ${IMGS[@]}
do
    unset build
    unset build_ctx

    if containsElement "${IMG}" "${SKIP_IMGS[@]}" ; then
        echo [Skipping] $IMG
        continue
    fi

    # JupyterLab server
    if [ $IMG == "jupyter-server" ]; then

        build_ctx=$DIR/../services/jupyter-server
        build=(docker build --progress=plain \
            -t "orchest/jupyter-server:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/jupyter-server/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)

    fi


    # Jupyter Enterprise Gateway
    if [ $IMG == "jupyter-enterprise-gateway" ]; then

        build_ctx=$DIR/../services/jupyter-enterprise-gateway
        build=(docker build --progress=plain \
            -t "orchest/jupyter-enterprise-gateway:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/jupyter-enterprise-gateway/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)

    fi

    if [ $IMG == "celery-worker" ]; then

        build_ctx=$DIR/../services/orchest-api
        build=(docker build --progress=plain \
            -t "orchest/celery-worker:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/orchest-api/Dockerfile_celery \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)

    fi

    # custom enterprise gateway kernel images
    # install orchest-sdk
    if [ $IMG == "base-kernel-py" ]; then

        build_ctx=$DIR/../services/base-images
        build=(docker build --progress=plain \
            -t "orchest/base-kernel-py:$BUILD_TAG" \
            -f $DIR/../services/base-images/base-kernel-py/Dockerfile \
            --no-cache=$NO_CACHE \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)

    fi

    if [ $IMG == "base-kernel-julia" ]; then

        build_ctx=$DIR/../services/base-images
        build=(docker build --progress=plain \
            -t "orchest/base-kernel-julia:$BUILD_TAG" \
            -f $DIR/../services/base-images/base-kernel-julia/Dockerfile \
            --no-cache=$NO_CACHE \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)

    fi

    if [ $IMG == "base-kernel-py-gpu" ]; then

        build_ctx=$DIR/../services/base-images
        build=(docker build --progress=plain \
            -t "orchest/base-kernel-py-gpu:$BUILD_TAG" \
            -f $DIR/../services/base-images/base-kernel-py-gpu/Dockerfile \
            --no-cache=$NO_CACHE \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)

    fi

    if [ $IMG == "base-kernel-r" ]; then

        build_ctx=$DIR/../services/base-images
        build=(docker build --progress=plain \
            -t "orchest/base-kernel-r:$BUILD_TAG" \
            -f $DIR/../services/base-images/base-kernel-r/Dockerfile \
            --no-cache=$NO_CACHE \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    # application images
    if [ $IMG == "orchest-api" ]; then

        build_ctx=$DIR/../services/orchest-api
        build=(docker build --progress=plain \
            -t "orchest/orchest-api:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/orchest-api/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    if [ $IMG == "orchest-ctl" ]; then

        build_ctx=$DIR/../services/orchest-ctl
        build=(docker build --progress=plain \
            -t "orchest/orchest-ctl:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/orchest-ctl/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    if [ $IMG == "update-server" ]; then

        build_ctx=$DIR/../services/update-server
        build=(docker build --progress=plain \
            -t "orchest/update-server:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/update-server/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    if [ $IMG == "file-manager" ]; then

        build_ctx=$DIR/../services/file-manager
        build=(docker build --progress=plain \
            -t "orchest/file-manager:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/file-manager/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    if [ $IMG == "orchest-webserver" ]; then

        build_ctx=$DIR/../services/orchest-webserver
        build=(docker build --progress=plain \
            -t "orchest/orchest-webserver:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/orchest-webserver/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    if [ $IMG == "nginx-proxy" ]; then
        build_ctx=$DIR/../services/nginx-proxy
        build=(docker build --progress=plain \
            -t "orchest/nginx-proxy:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/nginx-proxy/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    if [ $IMG == "auth-server" ]; then

        build_ctx=$DIR/../services/auth-server
        build=(docker build --progress=plain \
            -t "orchest/auth-server:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/auth-server/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    # installs orchest-sdk
    if [ $IMG == "memory-server" ]; then
        build_ctx=$DIR/../services/memory-server
        build=(docker build --progress=plain \
            -t "orchest/memory-server:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/memory-server/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    if [ $IMG == "session-sidecar" ]; then
        build_ctx=$DIR/../services/session-sidecar
        build=(docker build --progress=plain \
            -t "orchest/session-sidecar:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/session-sidecar/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    if [ -n "$build" ]; then

        CLEANUP_BUILD_CTX+=($build_ctx)
        CLEANUP_IMAGES+=($IMG)

        if $VERBOSE; then
            run_build $IMG $build $build_ctx
        else
            run_build $IMG $build $build_ctx &
        fi
    fi

done

wait < <(jobs -p)

cleanup

echo "[Done]!"

