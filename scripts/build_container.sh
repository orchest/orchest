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
while getopts "s:i:t:no:vemM" opt; do
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
    m)
      # Build minimal set of images.
      SKIP_IMGS+=("base-kernel-py")
      SKIP_IMGS+=("base-kernel-julia")
      SKIP_IMGS+=("base-kernel-javascript")
      SKIP_IMGS+=("base-kernel-r")
      ;;
    M)
      # Build absolute minimal set of images.
      SKIP_IMGS+=("base-kernel-py")
      SKIP_IMGS+=("base-kernel-julia")
      SKIP_IMGS+=("base-kernel-javascript")
      SKIP_IMGS+=("base-kernel-r")
      SKIP_IMGS+=("jupyter-server")
      SKIP_IMGS+=("jupyter-enterprise-gateway")
      SKIP_IMGS+=("session-sidecar")
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
        "base-kernel-r"
        "base-kernel-julia"
        "base-kernel-javascript"
        "orchest-api"
        "orchest-webserver"
        "session-sidecar"
        "auth-server"
        "node-agent"
        "orchest-controller"
        "image-puller"
        "image-builder-buildx"
        "image-builder-buildkit"
        "buildkit-daemon"
    )
fi

LIB_IMAGES=(
    "base-kernel-py"
    "base-kernel-r"
    "base-kernel-julia"
    "base-kernel-javascript"
    "orchest-api"
    "orchest-webserver"
    "session-sidecar"
    "auth-server"
    "celery-worker"
    "jupyter-enterprise-gateway"
    "jupyter-server"
    "node-agent"
)

PNPM_FILES=(
    "pnpm-lock.yaml"
    "pnpm-workspace.yaml"
    "package.json"
    "tsconfig.json"
)

PNPM_IMAGES=(
    "orchest-webserver"
    "auth-server"
)
# TODO: add auth-server

SDK_IMAGES=(
    "base-kernel-py"
    "base-kernel-r"
    "base-kernel-julia"
    "base-kernel-javascript"
)

CLI_IMAGES=(
    "orchest-api"
    "celery-worker"
)

UTILITY_IMAGES=(
    "image-puller"
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
    unset build
    unset build_ctx

    image=$1
    build_ctx=$2
    shift
    shift
    build="$@"

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
        if containsElement "${image}" "${CLI_IMAGES[@]}" ; then
            cp -r $DIR/../orchest-cli $build_ctx/orchest-cli 2>/dev/null
        fi
    fi
    # copy end

    verbose_command_wrapper "$@"

    if [ $? = 0 ]; then
        echo [Building] $image succeeded.
    else
        echo [Building] $image failed.
    fi

}

verbose_command_wrapper () {
    if $VERBOSE; then
        "$@"
    else
        output=$("$@" 2>&1)
        if ! [ $? = 0 ]; then
            echo "$output"
        fi
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
                rm -rf $i/pnpm_files 2>/dev/null
            fi
            if containsElement "${image}" "${CLI_IMAGES[@]}" ; then
                rm -rf $i/orchest-cli 2>/dev/null
            fi

            rm $i/.dockerignore 2> /dev/null
        fi
        D=$(expr $D + 1)
    done

    # Clean up any jupyter-server-user-configured images
    JUPYTER_USER_IMAGES=$(docker images -q orchest-jupyter-server-user-configured)

    if ! [ -z "$JUPYTER_USER_IMAGES" ]; then
        docker rmi $JUPYTER_USER_IMAGES >/dev/null
    fi

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
        build=(docker build --platform linux/amd64 --progress=plain \
            -t "orchest/jupyter-server:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/jupyter-server/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)

    fi


    # Jupyter Enterprise Gateway
    if [ $IMG == "jupyter-enterprise-gateway" ]; then

        build_ctx=$DIR/../services/jupyter-enterprise-gateway
        build=(docker build --platform linux/amd64 --progress=plain \
            -t "orchest/jupyter-enterprise-gateway:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/jupyter-enterprise-gateway/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)

    fi

    if [ $IMG == "celery-worker" ]; then

        build_ctx=$DIR/../services/orchest-api
        build=(docker build --platform linux/amd64 --progress=plain \
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
        build=(docker build --platform linux/amd64 --progress=plain \
            -t "orchest/base-kernel-py:$BUILD_TAG" \
            -f $DIR/../services/base-images/base-kernel-py/Dockerfile \
            --no-cache=$NO_CACHE \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)

    fi

    if [ $IMG == "base-kernel-julia" ]; then

        build_ctx=$DIR/../services/base-images
        build=(docker build --platform linux/amd64 --progress=plain \
            -t "orchest/base-kernel-julia:$BUILD_TAG" \
            -f $DIR/../services/base-images/base-kernel-julia/Dockerfile \
            --no-cache=$NO_CACHE \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)

    fi

    if [ $IMG == "base-kernel-javascript" ]; then

        build_ctx=$DIR/../services/base-images
        build=(docker build --platform linux/amd64 --progress=plain \
            -t "orchest/base-kernel-javascript:$BUILD_TAG" \
            -f $DIR/../services/base-images/base-kernel-javascript/Dockerfile \
            --no-cache=$NO_CACHE \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)

    fi

    if [ $IMG == "base-kernel-r" ]; then

        build_ctx=$DIR/../services/base-images
        build=(docker build --platform linux/amd64 --progress=plain \
            -t "orchest/base-kernel-r:$BUILD_TAG" \
            -f $DIR/../services/base-images/base-kernel-r/Dockerfile \
            --no-cache=$NO_CACHE \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    # application images
    if [ $IMG == "orchest-api" ]; then

        build_ctx=$DIR/../services/orchest-api
        build=(docker build --platform linux/amd64 --progress=plain \
            -t "orchest/orchest-api:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/orchest-api/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    if [ $IMG == "node-agent" ]; then

        build_ctx=$DIR/../services/node-agent
        build=(docker build --progress=plain \
            -t "orchest/node-agent:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/node-agent/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    if [ $IMG == "orchest-webserver" ]; then

        build_ctx=$DIR/../services/orchest-webserver
        build=(docker build --platform linux/amd64 --progress=plain \
            -t "orchest/orchest-webserver:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/orchest-webserver/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    if [ $IMG == "auth-server" ]; then

        build_ctx=$DIR/../services/auth-server
        build=(docker build --platform linux/amd64 --progress=plain \
            -t "orchest/auth-server:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/auth-server/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    if [ $IMG == "orchest-controller" ]; then

        build_ctx=$DIR/../services/orchest-controller
        build=(docker build --platform linux/amd64 --progress=plain \
            -t "orchest/orchest-controller:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/orchest-controller/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)

        # on orchest-controller build we generate the orchest-controller build manifests
        if [ -x "$(command -v helm)" ] && [ -x "$(command -v make)" ] && [ -x "$(command -v go)" ]; then
            verbose_command_wrapper bash -c \
                "TAGNAME=$ORCHEST_VERSION make -C ./services/orchest-controller manifestgen"
        else
            # NOTE: Don't fail! Because that would break the Docker CI
            # on release. The requirement is only needed for development.
            echo "To develop Orchest you need to satisfy the prerequisites listed at:"
            echo "https://docs.orchest.io/en/latest/development/development_workflow.html#prerequisites"
        fi
    fi

    if [ $IMG == "session-sidecar" ]; then
        build_ctx=$DIR/../services/session-sidecar
        build=(docker build --platform linux/amd64 --progress=plain \
            -t "orchest/session-sidecar:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/session-sidecar/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    # building utility-containers
    if [ $IMG == "image-puller" ]; then
        build_ctx=$DIR/../utility-containers/image-puller
        build=(docker build --platform linux/amd64 --progress=plain \
            -t "orchest/image-puller:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../utility-containers/image-puller/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    if [ $IMG == "image-builder-buildx" ]; then
        build_ctx=$DIR/../utility-containers/image-builder-buildx
        build=(docker build --platform linux/amd64 --progress=plain \
            -t "orchest/image-builder-buildx:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../utility-containers/image-builder-buildx/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    if [ $IMG == "image-builder-buildkit" ]; then
        build_ctx=$DIR/../utility-containers/image-builder-buildkit
        build=(docker build --platform linux/amd64 --progress=plain \
            -t "orchest/image-builder-buildkit:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../utility-containers/image-builder-buildkit/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    if [ $IMG == "buildkit-daemon" ]; then

        build_ctx=$DIR/../services/buildkit-daemon
        build=(docker build --progress=plain \
            -t "orchest/buildkit-daemon:$BUILD_TAG" \
            --no-cache=$NO_CACHE \
            -f $DIR/../services/buildkit-daemon/Dockerfile \
            --build-arg ORCHEST_VERSION="$ORCHEST_VERSION"
            $build_ctx)
    fi

    if [ -n "$build" ]; then

        CLEANUP_BUILD_CTX+=($build_ctx)
        CLEANUP_IMAGES+=($IMG)

        if $VERBOSE; then
            run_build $IMG $build_ctx "${build[@]}"
        else
            run_build $IMG $build_ctx "${build[@]}" &
        fi
    fi

done

wait < <(jobs -p)

cleanup

echo "[Done]!"
