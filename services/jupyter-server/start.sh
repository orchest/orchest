#!/usr/bin/env bash

###
# This script manages JupyterLab extensions.
# Users are able to install extensions through the JupyterLab GUI.
# The base Jupyter server image includes a number of default
# extensions including the Orchest extensions.
# In the GUI of Orchest users can install server side JupyterLab extensions
# with a bash script that runs inside an image build.
#
# JupyterLab on the client side has pre-built and source extensions.
# In addition JupyterLab supports server-side extensions that
# are installed as conda or pip Python packages.
# - pre-built extensions reside in /usr/local/share/jupyter/labextensions as
#   directories with compiled assets
# - source extensions reside in /usr/local/share/jupyter/lab/extensions as tarballs
# - server side extensions are standard Python packages.
###

umask 002

# This is where the Docker image puts pre-installed extensions during build
build_path=/jupyterlab-orchest-build

# This is the default path JupyterLab uses as the application directory.
userdir_path=/usr/local/share/jupyter/lab

###
# The lockdir is used to make sure
# that this JupyterLab start script
# is only executed for one instance
# at a time.
###
lockdir=$userdir_path/.bootlock

acquire_lock() {
    while :
    do
        if mkdir $lockdir 2>/dev/null; then
            break
        fi

        echo "Awaiting boot lock..."
        sleep 1
    done
}

release_lock() {
    rm -rf $lockdir
}

start_jupyterlab(){
    release_lock
    # Don't release the lock again on exit.
    trap - EXIT
    jupyter lab --LabApp.app_dir="$userdir_path" "$@"
}

acquire_lock
# Make sure the lock is released if, for some reason, the process does
# not get to release the lock. Does not cover the case of SIGKILL.
trap release_lock EXIT

pre_installed_extensions=("orchest-integration" "visual-tags" "nbdime-jupyterlab")

check_ext_versions() {
    # Gets the versions that Orchest needs to run from $1
    # As can be seen in https://stackoverflow.com/a/45201229 it is a
    # complete pain to split a variable on a delimeter. And so here,
    # instead of creating one regex, we create one for every extension.
    for i in "${pre_installed_extensions[@]}"
    do
        version=$(echo $1 | grep -o -P "$i v\d+\.\d+\.\d+")
        [ -z "$(echo $2 | grep -o -F "$version")" ] && return 1
    done

    return 0
}

# Check whether this is the first time ever JupyterLab is started.
userdir_version=$(jq .jupyterlab.version "$userdir_path/static/package.json" 2>/dev/null)
if [ -z "$userdir_version" ]; then
    cp -rfT "$build_path" "$userdir_path"
    start_jupyterlab "$@"
    exit 0
fi

# Clear uninstalled_core_extensions
build_config=$userdir_path/settings/build_config.json
if test -f "$build_config"; then
    echo "Clearing uninstalled_core_extensions $build_config"
    jq ".uninstalled_core_extensions = []" $build_config > $build_config.tmp
    mv -f $build_config.tmp $build_config
fi

# Get installed extensions.
# NOTE: These commands take about 1s each because Jupyter starts a
# full App. To speed things up we can postpone getting the extension
# versions until after we have done a check of
#   build_version == userdir_version && Orchest was not updated
# because if Orchest wasn't updated, then it is a very small edge
# case that our extensions have updated (it would mean a user did
# so manually through the JLab setup script).
ext_orchest=$(jupyter labextension list \
                     --BaseExtensionApp.app_dir="$build_path" 2>&1)
ext_userdir=$(jupyter labextension list \
                     --BaseExtensionApp.app_dir="$userdir_path" 2>&1)

# Get the versions of the extensions of the freshly build Orchest
# version and check whether the existing versions (in the userdir) are
# the same.
check_ext_versions "$ext_orchest" "$ext_userdir"
if [ $? -eq 1 ]; then
    equal_ext_versions=false
else
    equal_ext_versions=true
fi

build_version=$(jq .jupyterlab.version "$build_path/static/package.json")

# Add new extension tarballs to `extensions/` that are
# part of the build_path (e.g. because of a user image build).
# This way the extensions get automatically included in the build.
# Note: new extensions should trigger a build automatically.
cp -rnT "$build_path/extensions" "$userdir_path/extensions"

# Both the JupyterLab version and the extension versions of the build
# and userdir need to be equal. Because:
# - We could have updated the extensions without having updated
#   JupyterLab. However, these updated extensions could be required for
#   JupyterLab to work correctly inside Orchest.
# - If the build version is not the same, then we can't guarantee
#   anything about compatibility.
if [ "$build_version" = "$userdir_version" ] && $equal_ext_versions; then
    # We don't have to do anything.
    start_jupyterlab "$@"
    exit 0
fi

echo "Pre installed extensions have changed, partially clearing \
JupyterLab userdir config."

# In case JupyterLab was upgraded we need to remove all files that
# could potentially cause compatibility issues with the new version.
find "$userdir_path" \
    -maxdepth 1 \
    ! \( \
        -type d -a \( -name "extensions" -o -name "themes" \) \
        -o -name ".gitignore" \
        -o -wholename "$userdir_path" \
        -o -wholename "$lockdir" \
    \) \
    -exec rm -rf {} \;

# Overwrite the static files from the userdir with the static files
# from the build. Otherwise JupyterLab cannot start as part of Orchest.
find "$build_path" \
    -maxdepth 1 \
    ! \( \
        -type d -a \( -name "extensions" -o -name "themes" \) \
        -o -name ".gitignore" \
        -o -wholename "$build_path" \
    \) \
    -exec cp -r {} "$userdir_path" \;

start_jupyterlab "$@"
