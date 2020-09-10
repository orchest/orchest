#!/bin/bash

# Use another Docker backend for building.
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
IMGS=()
NO_CACHE=false
VERBOSE=false
ENABLE_SSL=false

# Read flags.
while getopts "s:i:nve" opt; do
  case $opt in
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

LIB_IMAGES=(
    "custom-base-kernel-py"
    "custom-base-kernel-r"
    "orchest-api"
    "orchest-webserver"
    "memory-server"
    "auth-server"
    "celery-worker"
)
SDK_IMAGES=(
    "memory-server"
    "custom-base-kernel-py"
    "custom-base-kernel-r"
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

        cp $DIR/../.dockerignore $build_ctx/.dockerignore

        if containsElement "${image}" "${LIB_IMAGES[@]}" ; then
            cp -r $DIR/../lib $build_ctx/lib
        fi
        if containsElement "${image}" "${SDK_IMAGES[@]}" ; then
            cp -r $DIR/../orchest-sdk $build_ctx/orchest-sdk
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

# Build the images.
for IMG in ${IMGS[@]}
do
    unset build
    unset build_ctx

    # JupyterLab server
    if [ $IMG == "jupyter-server" ]; then

        build_ctx=$DIR/../orchest/jupyter-server
        build=(docker build \
            -t orchestsoftware/jupyter-server \
            --no-cache=$NO_CACHE \
            -f $DIR/../orchest/jupyter-server/Dockerfile \
            $build_ctx)

    fi

    if [ $IMG == "celery-worker" ]; then

        build_ctx=$DIR/../orchest/orchest-api
        build=(docker build \
            -t orchestsoftware/celery-worker \
            --no-cache=$NO_CACHE \
            -f $DIR/../orchest/orchest-api/Dockerfile_celery \
            $build_ctx)

    fi

    # custom enterprise gateway kernel images
    # install orchest-sdk
    if [ $IMG == "custom-base-kernel-py" ]; then

        build_ctx=$DIR/../orchest/custom-images
        build=(docker build \
            -t orchestsoftware/custom-base-kernel-py \
            -f $DIR/../orchest/custom-images/custom-base-kernel-py/Dockerfile \
            --no-cache=$NO_CACHE \
            $build_ctx)

    fi

    if [ $IMG == "custom-base-kernel-r" ]; then

        build_ctx=$DIR/../orchest/custom-images
        build=(docker build \
            -t orchestsoftware/custom-base-kernel-r \
            -f $DIR/../orchest/custom-images/custom-base-kernel-r/Dockerfile \
            --no-cache=$NO_CACHE \
            $build_ctx)
    fi

    # application images
    if [ $IMG == "orchest-api" ]; then

        build_ctx=$DIR/../orchest/orchest-api
        build=(docker build \
            -t orchestsoftware/orchest-api \
            --no-cache=$NO_CACHE \
            -f $DIR/../orchest/orchest-api/Dockerfile \
            $build_ctx)
    fi

    if [ $IMG == "orchest-ctl" ]; then

        build_ctx=$DIR/../orchest/orchest-ctl
        build=(docker build \
            -t orchestsoftware/orchest-ctl \
            --no-cache=$NO_CACHE \
            -f $DIR/../orchest/orchest-ctl/Dockerfile \
            $build_ctx)
    fi

    if [ $IMG == "orchest-webserver" ]; then

        # Cleanup dev symlinks
        $DIR/dev_compile_cleanup.sh

        build_ctx=$DIR/../orchest/orchest-webserver
        build=(docker build \
            -t orchestsoftware/orchest-webserver \
            --no-cache=$NO_CACHE \
            -f $DIR/../orchest/orchest-webserver/Dockerfile \
            $build_ctx)
    fi

    if [ $IMG == "nginx-proxy" ]; then
        build_ctx=$DIR/../orchest/nginx-proxy
        build=(docker build \
            -t orchestsoftware/nginx-proxy \
            --no-cache=$NO_CACHE \
            --build-arg enable_ssl=$ENABLE_SSL \
            -f $DIR/../orchest/nginx-proxy/Dockerfile \
            $build_ctx)
    fi

    if [ $IMG == "auth-server" ]; then

        # Cleanup dev symlinks
        $DIR/dev_compile_cleanup.sh

        build_ctx=$DIR/../orchest/auth-server
        build=(docker build \
            -t orchestsoftware/auth-server \
            --no-cache=$NO_CACHE \
            -f $DIR/../orchest/auth-server/Dockerfile \
            $build_ctx)
    fi

    # installs orchest-sdk
    if [ $IMG == "memory-server" ]; then
        build_ctx=$DIR/../orchest/memory-server
        build=(docker build \
            -t orchestsoftware/memory-server \
            --no-cache=$NO_CACHE \
            -f $DIR/../orchest/memory-server/Dockerfile \
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
# build context cleanup end

echo "[Done]!"

