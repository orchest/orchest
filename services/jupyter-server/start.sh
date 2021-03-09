#! /usr/bin/env sh

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

get_ext_versions() {
    # Gets the versions that Orchest needs to run from $1
    # As can be seen in https://stackoverflow.com/a/45201229 it is a
    # complete pain to split a variable on a delimeter. And so here,
    # instead of creating one regex, we create one for every extension.
    orchest_integration=$(echo $1 \
        | grep -o -P "orchest-integration v\d+\.\d+\.\d+")
    visual_tags=$(echo $1 \
        | grep -o -P "visual-tags v\d+\.\d+\.\d+")
}

check_versions() {
    # Checks $1 whether it contains the same setup as set by
    # `get_ext_versions`
    [ -z $(echo "$1" | grep -o -F "$orchest_integration") ] && return 1
    [ -z $(echo "$1" | grep -o -F "$visual_tags") ] && return 1
}

# This is where the Docker image puts pre-installed extensions during build
build_path=/jupyterlab-orchest-build

# This is the default path JupyterLab uses as the application directory.
userdir_path=/usr/local/share/jupyter/lab

# Check whether this is the first time ever JupyterLab is started.
userdir_version=$(jq .jupyterlab.version "$userdir_path/static/package.json" 2>/dev/null)
if [ -z $userdir_version ]; then
    cp -rfT "$build_path" "$userdir_path"
    jupyter lab --LabApp.app_dir="$userdir_path" "$@"
    exit 0
fi

# Get installed extensions.
ext_orchest=$(jupyter labextension list \
                     --BaseExtensionApp.app_dir="$build_path" 2>&1)
ext_userdir=$(jupyter labextension list \
                     --BaseExtensionApp.app_dir="$userdir_path" 2>&1)

# Get the versions of the extensions of the freshly build Orchest
# version and check whether the existing versions (in the userdir) are
# the same.
get_ext_versions "$ext_orchest"
check_versions "$ext_userdir"

if [ $? -eq 1 ]; then
    equal_ext_versions=false
else
    equal_ext_versions=true
fi

# If JupyterLab was updated then we always need to update the
# configuration from the userdir.
build_version=$(jq .jupyterlab.version "$build_path/static/package.json")

# Add new extension tarballs to `extensions/`. This way the
# extensions get automatically included in the build.
# Note: new extensions should trigger a build automatically.
cp -rnT "$build_path/extensions" "$userdir_path/extensions"

if [ "$build_version" = "$userdir_version" ] && $equal_ext_versions; then
    # We don't have to do anything.
    jupyter lab --LabApp.app_dir="$userdir_path" "$@"
    exit 0
fi

# Force add extension tarballs to `extensions/`. This way the Orchest
# and image included extensions get automatically included in the build.
cp -rf $build_path/extensions/orchest-integration* "$userdir_path/extensions"
cp -rf $build_path/extensions/visual-tags* "$userdir_path/extensions"

# Overwrite the static files from the userdir with the static files
# from the build. Otherwise JupyterLab cannot start as part of Orchest.
rm -rf "$userdir_path/static" && cp -r "$build_path/static" "$userdir_path/static"

jupyter lab --LabApp.app_dir="$userdir_path" "$@"
