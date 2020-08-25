#!/bin/bash

# Use another Docker backend for building.

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
IMGS=()
SDK_BRANCH="master"
NO_CACHE=false
VERBOSE=false
ENABLE_SSL=false

# Read flags.
while getopts "s:i:nve" opt; do
  case $opt in
    s)
      SDK_BRANCH=$OPTARG
      echo "Using SDK branch $OPTARG"
      ;;
    i)
      IMGS+=($OPTARG)
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
        "celery-worker"
        "custom-base-kernel-py"
        "custom-base-kernel-r"
        "orchest-api"
        "orchest-ctl"
        "orchest-webserver"
        "nginx-proxy"
        "memory-server"
        "auth-server"
    )
fi

run_build () {

    echo [Building] $1

    build=$2
    build_ctx=$3

    if ! [ -z "$build_ctx" ]; then
        # copy lib in build_ctx
        cp -r $DIR/../lib $build_ctx/lib
    fi

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

    if ! [ -z "$build_ctx" ]; then
        rm -r $build_ctx/lib
    fi
}

# Build the images.
for IMG in ${IMGS[@]}
do
    unset build
    unset build_ctx

    # JupyterLab server
    if [ $IMG == "jupyter-server" ]; then

        build=(docker build \
            -t orchestsoftware/jupyter-server \
            --no-cache=$NO_CACHE \
            -f $DIR/../orchest/jupyter-server/Dockerfile \
            $DIR/../orchest/jupyter-server/)

    fi

    if [ $IMG == "celery-worker" ]; then

        build=(docker build \
            -t orchestsoftware/celery-worker \
            --no-cache=$NO_CACHE \
            -f $DIR/../orchest/orchest-api/Dockerfile_celery \
            $DIR/../orchest/orchest-api/)

    fi

    # custom enterprise gateway kernel images
    # install orchest-sdk
    if [ $IMG == "custom-base-kernel-py" ]; then

        build_ctx=$DIR/../orchest/custom-images
        build=(docker build \
            -t orchestsoftware/custom-base-kernel-py \
            -f $DIR/../orchest/custom-images/custom-base-kernel-py/Dockerfile \
            --build-arg sdk_branch=$SDK_BRANCH \
            --no-cache=$NO_CACHE \
            $build_ctx)
        
    fi

    if [ $IMG == "custom-base-kernel-r" ]; then
        build=(docker build \
            -t orchestsoftware/custom-base-kernel-r \
            -f $DIR/../orchest/custom-images/custom-base-kernel-r/Dockerfile \
            --build-arg sdk_branch=$SDK_BRANCH \
            --no-cache=$NO_CACHE \
            $DIR/../orchest/custom-images/)
    fi

    # application images
    if [ $IMG == "orchest-api" ]; then

        build_ctx=$DIR/../orchest/orchest-api/
        build=(docker build \
            -t orchestsoftware/orchest-api \
            --no-cache=$NO_CACHE \
            -f $DIR/../orchest/orchest-api/Dockerfile \
            $build_ctx)
    fi

    if [ $IMG == "orchest-ctl" ]; then
        build=(docker build \
            -t orchestsoftware/orchest-ctl \
            --no-cache=$NO_CACHE \
            -f $DIR/../orchest/orchest-ctl/Dockerfile \
            $DIR/../orchest/orchest-ctl/)
    fi

    if [ $IMG == "orchest-webserver" ]; then

        build_ctx=$DIR/../orchest/orchest-api/
        build=(docker build \
            -t orchestsoftware/orchest-webserver \
            --no-cache=$NO_CACHE \
            -f $DIR/../orchest/orchest-webserver/Dockerfile \
            $build_ctx)
    fi

    if [ $IMG == "nginx-proxy" ]; then
        build=(docker build \
            -t orchestsoftware/nginx-proxy \
            --no-cache=$NO_CACHE \
            --build-arg enable_ssl=$ENABLE_SSL \
            -f $DIR/../orchest/nginx-proxy/Dockerfile \
            $DIR/../orchest/nginx-proxy/)
    fi

    if [ $IMG == "auth-server" ]; then
        build_ctx=$DIR/../orchest/orchest-api/
        build=(docker build \
            -t orchestsoftware/auth-server \
            --no-cache=$NO_CACHE \
            -f $DIR/../orchest/auth-server/Dockerfile \
            $DIR/../orchest/auth-server/)
    fi

    # installs orchest-sdk
    if [ $IMG == "memory-server" ]; then
        build=(docker build \
            -t orchestsoftware/memory-server \
            --build-arg sdk_branch=$SDK_BRANCH \
            --no-cache=$NO_CACHE \
            -f $DIR/../orchest/memory-server/Dockerfile \
            $DIR/../orchest/memory-server/)
    fi

    if [ -n "$build" ]; then
        if $VERBOSE; then
            run_build $IMG $build $build_ctx
        else
            run_build $IMG $build $build_ctx &
        fi
    fi

done

wait < <(jobs -p)