#!/bin/bash

# Use another Docker backend for building.
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
IMGS=()
SKIP_IMGS=()
NO_CACHE=false
VERBOSE=false
ENABLE_SSL=false
RELEASE_TAG="latest"

# Read flags.
while getopts "s:i:t:nve" opt; do
  case $opt in
    i)
      IMGS+=($OPTARG)
      ;;
    s)
      SKIP_IMGS+=($OPTARG)
      ;;
    t)
      RELEASE_TAG="$OPTARG"
      ;;
    n)
      NO_CACHE=true
      echo "Cache disabled"
      ;;
    e)
      # 'e' for encryption
      ENABLE_SSL=true
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
        "orchest-api"
        "orchest-ctl"
        "update-server"
        "orchest-webserver"
        "nginx-proxy"
        "memory-server"
        "auth-server"
        "file-manager"
    )
fi

LIB_IMAGES=(
    "base-kernel-py"
    "base-kernel-py-gpu"
    "base-kernel-r"
    "orchest-api"
    "orchest-webserver"
    "memory-server"
    "auth-server"
    "update-server"
    "celery-worker"
    "jupyter-enterprise-gateway"
)
SDK_IMAGES=(
    "base-kernel-py"
    "base-kernel-py-gpu"
    "base-kernel-r"
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
                rm -r $i/lib 2> /dev/null
            fi
            if containsElement "${image}" "${SDK_IMAGES[@]}" ; then
                rm -r $i/orchest-sdk 2> /dev/null
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
        build=(docker build \
            -t "orchest/jupyter-server:$RELEASE_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/jupyter-server/Dockerfile \
            $build_ctx)

    fi


    # Jupyter Enterprise Gateway
    if [ $IMG == "jupyter-enterprise-gateway" ]; then

        build_ctx=$DIR/../services/jupyter-enterprise-gateway
        build=(docker build \
            -t "orchest/jupyter-enterprise-gateway:$RELEASE_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/jupyter-enterprise-gateway/Dockerfile \
            $build_ctx)

    fi

    if [ $IMG == "celery-worker" ]; then

        build_ctx=$DIR/../services/orchest-api
        build=(docker build \
            -t "orchest/celery-worker:$RELEASE_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/orchest-api/Dockerfile_celery \
            $build_ctx)

    fi

    # custom enterprise gateway kernel images
    # install orchest-sdk
    if [ $IMG == "base-kernel-py" ]; then

        build_ctx=$DIR/../services/base-images
        build=(docker build \
            -t "orchest/base-kernel-py:$RELEASE_TAG" \
            -f $DIR/../services/base-images/base-kernel-py/Dockerfile \
            --no-cache=$NO_CACHE \
            $build_ctx)

    fi

    if [ $IMG == "base-kernel-py-gpu" ]; then

        build_ctx=$DIR/../services/base-images
        build=(docker build \
            -t "orchest/base-kernel-py-gpu:$RELEASE_TAG" \
            -f $DIR/../services/base-images/base-kernel-py-gpu/Dockerfile \
            --no-cache=$NO_CACHE \
            $build_ctx)

    fi

    if [ $IMG == "base-kernel-r" ]; then

        build_ctx=$DIR/../services/base-images
        build=(docker build \
            -t "orchest/base-kernel-r:$RELEASE_TAG" \
            -f $DIR/../services/base-images/base-kernel-r/Dockerfile \
            --no-cache=$NO_CACHE \
            $build_ctx)
    fi

    # application images
    if [ $IMG == "orchest-api" ]; then

        build_ctx=$DIR/../services/orchest-api
        build=(docker build \
            -t "orchest/orchest-api:$RELEASE_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/orchest-api/Dockerfile \
            $build_ctx)
    fi

    if [ $IMG == "orchest-ctl" ]; then

        build_ctx=$DIR/../services/orchest-ctl
        build=(docker build \
            -t "orchest/orchest-ctl:$RELEASE_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/orchest-ctl/Dockerfile \
            $build_ctx)
    fi

    if [ $IMG == "update-server" ]; then

        build_ctx=$DIR/../services/update-server
        build=(docker build \
            -t "orchest/update-server:$RELEASE_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/update-server/Dockerfile \
            $build_ctx)
    fi

    if [ $IMG == "file-manager" ]; then

        build_ctx=$DIR/../services/file-manager
        build=(docker build \
            -t "orchest/file-manager:$RELEASE_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/file-manager/Dockerfile \
            $build_ctx)
    fi

    if [ $IMG == "orchest-webserver" ]; then

        # Cleanup dev symlinks
        $DIR/dev_compile_cleanup.sh

        build_ctx=$DIR/../services/orchest-webserver
        build=(docker build \
            -t "orchest/orchest-webserver:$RELEASE_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/orchest-webserver/Dockerfile \
            $build_ctx)
    fi

    if [ $IMG == "nginx-proxy" ]; then
        build_ctx=$DIR/../services/nginx-proxy
        build=(docker build \
            -t "orchest/nginx-proxy:$RELEASE_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/nginx-proxy/Dockerfile \
            $build_ctx)
    fi

    if [ $IMG == "auth-server" ]; then

        # Cleanup dev symlinks
        $DIR/dev_compile_cleanup.sh

        build_ctx=$DIR/../services/auth-server
        build=(docker build \
            -t "orchest/auth-server:$RELEASE_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/auth-server/Dockerfile \
            $build_ctx)
    fi

    # installs orchest-sdk
    if [ $IMG == "memory-server" ]; then
        build_ctx=$DIR/../services/memory-server
        build=(docker build \
            -t "orchest/memory-server:$RELEASE_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/memory-server/Dockerfile \
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

