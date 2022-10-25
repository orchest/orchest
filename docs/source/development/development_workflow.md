(development-workflow)=

# Development workflow

(development-prerequisites)=

## Prerequisites

### Required software

You need the following installed to contribute to Orchest:

- Python version `3.x`
- [Go](https://go.dev/doc/install): Used by the `orchest-controller` and needed to run our
  `scripts/build_container.sh` to build Orchest's images.
- [Docker](https://docs.docker.com/get-docker/): To build Orchest's images.
- [minikube](https://minikube.sigs.k8s.io/docs/start/): To deploy Orchest on a local cluster.
- [kubectl](https://kubernetes.io/docs/tasks/tools/#kubectl): To manage k8s clusters.
- [helm](https://helm.sh/docs/intro/install/): Needed to run our `scripts/build_container.sh` to
  create the manifests to deploy the `orchest-controller`.
- [pre-commit](https://pre-commit.com/#installation): Running pre-commit hooks, e.g. linters.
- [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) and
  [pnpm](https://pnpm.io/installation#using-npm): To develop the front-end code of Orchest.
- [Google Chrome](https://www.google.com/chrome/): Requirement to run integration tests locally.

Optional, but highly recommended:

- [k9s](https://github.com/derailed/k9s): Terminal UI to manage k8s clusters.
- [jq](https://stedolan.github.io/jq/): Useful when working with JSON in your terminal.
- [gron](https://github.com/tomnomnom/gron): Make JSON greppable.

````{dropdown} 🎉 In case you dare to run a script to install all of the above
**Requires to be on Linux**
```sh
cd ~/Downloads

# go
curl -L https://go.dev/dl/go1.18.3.linux-amd64.tar.gz -o go.tar.gz
sudo tar -C /usr/local -xzf go.tar.gz

# Docker
# https://docs.docker.com/engine/install/ubuntu/#install-using-the-convenience-script
# https://docs.docker.com/engine/install/linux-postinstall/
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo groupadd docker
sudo usermod -aG docker $USER
newgrp docker

# minikube
# https://minikube.sigs.k8s.io/docs/start/
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# kubectl
# https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/#install-kubectl-binary-with-curl-on-linux
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# helm
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh -v v3.9.0

# pre-commit
pip install pre-commit

# Node and npm
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm
sudo npm install -g pnpm

## --- Extra's
# k9s
curl -L https://github.com/derailed/k9s/releases/download/v0.25.21/k9s_Linux_x86_64.tar.gz -o k9s.tar.gz
tar -C ~/.local/bin -xzf k9s.tar.gz
```
````

### Dependencies

After installing the required software, you need to configure the tools and install additional
dependencies.

```{note}
Make sure you are inside the root of the `orchest` repository.
```

```bash
# Set-up pre-commit:
pre-commit install
# Install frontend dependencies for local development:
npm run setup --install && pnpm i
# Install the Orchest CLI to manage the Orchest Cluster in k8s:
python3 -m pip install -e orchest-cli
# Install dependencies to build the docs:
python3 -m pip install -r docs/requirements.txt
```

Orchest's integration tests require a MySQL client to be installed:

`````{tab-set}
````{tab-item} Linux
```bash
sudo apt install -y default-libmysqlclient-dev
```
````
````{tab-item} macOS
```bash
brew install mysql
```
````
`````

(cluster-mount)=

### Cluster for development

Currently, the development tools assume that you have Orchest installed on a local minikube cluster.
To get the best development experience, it is recommended to mount the Orchest repository in minikube
which allows for {ref}`incremental development <incremental-development>`.

```{note}
Make sure you are inside the root of the `orchest` repository.
```

```bash
# Delete any existing cluster
minikube delete

# Start minikube with the repository mounted in the required place
# for hot reloading to work.
minikube start \
  --cpus max \
  --memory max \
  --addons ingress metrics-server \
  --mount-string="$(pwd):/orchest-dev-repo" --mount
```

## Installing Orchest for development

Now when all dependencies are installed and your cluster is set up, you can install Orchest!

But before doing so, it is important to realize that the Docker daemon of your host is different from the Docker daemon
of minikube. This means that you need to build Orchest's images on the minikube node in order for
minikube to be able to use them, otherwise it will pull the images from DockerHub. Note that
DockerHub only contains images of Orchest releases and not active code changes from GitHub branches.
Therefore it is important to configure your environment to use minikube's Docker daemon before
building images.

```{note}
The command below needs to be run in every terminal window you open!
```

```bash
# Use minikube's Docker daemon:
eval $(minikube -p minikube docker-env)
```

Next, you can build Orchest's images. Again, there is an important realization to make here and that
is that the images you build are given a specific _tag_. This tag is used by the Orchest Controller
(`orchest-controller`) to manage the Orchest Cluster, thus if you build images with tag `X` but
deploy the `orchest-controller` with tag `Y`, then the `orchest-controller` will start pulling the
images with tag `Y` from DockerHub (instead of using the locally built images with tag `X`). This
will become important when {ref}`rebuilding images after making code changes <dev-rebuilding-images>`.

```bash
# Verify whether you are using minikube's Docker daemon
echo "$MINIKUBE_ACTIVE_DOCKERD"
```

Let's build the minimal set of required images for Orchest to run:

```bash
# Set the *tag* to the latest Orchest version available
export TAG="$(orchest version --latest)"

# Build the minimal set of images for Orchest to run
scripts/build_container.sh -M -t $TAG -o $TAG
```

```{dropdown} 💡 Additional notes on the "scripts/build_container.sh" script
In this section we will quickly go over the most important options that can be passed to the
`scripts/build_container.sh` script. Note that, because Orchest is a fully containerized
application, the new images (the ones with your code changes) need to be build and used by the
cluster in order to reflect your changes.

- `-n`: Build the specified images but without using the existing Docker cache. Might be useful in
  case you are experiencing trouble building an image.
- `-i`: Build a specific image, e.g. `... -i orchest-api`
- `-m`: Build a minified set of images, that is, all images except base Environment images.
  Environment images don't need to be explicitly build in case you didn't make any changes to them
  (see {ref}`making Environment base image changes <environment-base-images-changes>`) and instead
  can be pulled in from DockerHub. Do note that the `$TAG` you are building Orchest with needs to be
  a valid image tag that exists for the image on [Orchest's
  DockerHub](https://hub.docker.com/u/orchest).
- `-M`: Build the absolute minimal set of images required by Orchest to run. On top of the `-m`
  option this also excludes all images for Sessions.
- `-v`: Run the script in verbose mode (useful for debugging), which will also disable parallel
  building of the images.

Any number of these options can be passed to the script.

Of course, all details about the script can be found by checking out its source code.
```

And finally, install Orchest:

```bash
# The --dev flag is used so that it doesn't pull in the release assets
# from GitHub, but instead uses the manifests from the local filesystem
# to deploy the Orchest Controller. NOTE: these manifests are automatically
# generated when running the above `build_container.sh` script ;)
orchest install --dev
```

Take a look in [k9s](https://github.com/derailed/k9s) and see how Orchest is getting installed.

Once the installation is completed you can reach Orchest using one of the following approaches,
depending on your operating system:

`````{tab-set}
````{tab-item} Linux
Simply access the Orchest UI by browsing to the IP returned by:
```bash
minikube ip
```
````
````{tab-item} macOS
Run the tunnel daemon and browse to [localhost](http://localhost).
```bash
sudo minikube tunnel
```
````
`````

Does everything look good? _Awesome!_ You're all set up and ready to start coding now! 🎉

Have a look at our {ref}`best practices <best practices>` and our [GitHub](https://github.com/orchest/orchest/issues)
to find interesting issues to work on.

## Redeploying Orchest after code changes

```{warning}
Running `minikube delete` is not recommend because it will lose the Docker cache on the minikube
node, making rebuilding images very slow. Luckily, it is unlikely you will need to (ever) run
`minikube delete`.
```

In this section we will go over the three ways to "redeploy" Orchest to reflect your code changes.
Note that each approach is best used in specific circumstances.

- _Using development mode to automatically reflect code changes._
  ({ref}`link <incremental-development>`)
  Best used when working on a PR and you would like to see your code changes immediately, especially
  useful when developing the front-end (e.g. `orchest-webserver`).
- _Rebuilding and redeploying only the service's image that you made changes to._
  ({ref}`link <dev-rebuilding-images>`)
  Best used when you know the code changes affect only one service and you don't want to fully
  re-install Orchest. For example, you want to test a PR that only changed the front-end and want to
  run in production mode instead of development mode.
- _Completely uninstalling and installing Orchest again._
  ({ref}`link <dev-reinstalling-orchest>`)
  When making larger changes that touch different parts of Orchest, it is a good idea to fully
  re-install Orchest. Do note that this should be rather fast because the Docker cache is used when
  rebuilding images.

(incremental-development)=

### Development mode (incremental development)

For the next steps, we assume you already installed Orchest.

To get "hot reloading", you need to make sure your minikube cluster was created using the above
{ref}`mount command <cluster-mount>` and have Orchest serve files from your local filesystem (that
contains code changes) instead of the files baked into the Docker images. To achieve the latter,
simply run:

**Note**: Don't forget to disable cache (DevTools -> Disable cache) or force reload (Command/Ctrl + Shift + R)
to see frontend changes propagate.

```bash
# In case any new dependencies were changed or added they need
# to be installed
pnpm i

# Run the client dev server for hot reloading of client (i.e. FE)
# files
pnpm run dev

# Get the Orchest Cluster to serve files from your local filesystem.
orchest patch --dev
```

**Note**: Your cluster will stay in `--dev` mode until you unpatch it (using `orchest patch --no-dev`).

The services that support incremental development are:

- `orchest-webserver`
- `orchest-api`
- `auth-server`

For changes to all other services, you need to redeploy the respective image as described in the
next section.

```{note}
Even if you do incremental development, it is good practice to rebuild the containers and run in
production mode before opening a PR (see {ref}`before committing <before-committing>`).
```

#### Teardown

If at any point you want to disable incremental development, proceed as follows:

```bash
# Kill the client dev server
kill $(pidof pnpm)

# Revert the patch
orchest patch --no-dev
```

To stop the cluster, it's enough to call `minikube stop`, which will stop all the pods.

#### Switching branches

If you have a running development installation with hot reloading, every time you make a change to
the code it will be automatically reloaded. However, when switching git branches that are very
different, or if changes to certain core components were made, this procedure might produce
inconsistent results. A safer way to proceed is to uninstall Orchest before making the switch, see
{ref}`re-installing Orchest <dev-reinstalling-orchest>`.

(dev-rebuilding-images)=

### Rebuilding images

To easily test code changes of an arbitrary service, you will need to:

1. rebuild the respective Docker image and
2. make it available to the k8s deployment.

The procedure changes slightly depending on the deployment type, i.e. single-node or multi-node.
Luckily, in the majority of cases you will be using a local single-node cluster (like the one you
created in the previous steps).

For the sake of simplicity (without loss of generality), let's assume you made changes to the
`orchest-api`.

`````{tab-set}
````{tab-item} Single node

Generally, single node deployments make it far easier to test changes. First of all, configure your
environment to use minikube's Docker daemon if you haven't already:

```bash
# If not active, set it
eval $(minikube -p minikube docker-env)
```

Now you're ready to rebuild the images, to which you made changes, using the `build_container.sh`
script.

**Note**: It is very important (otherwise your code changes will not be reflected) to use the *tag*
equal to the currently running Orchest version.

```bash
export TAG="$(orchest version)"

# Rebuild the images that need it
scripts/build_container.sh -i orchest-api -t $TAG -o $TAG
```

Alternatively, you can run `scripts/build_container.sh -M -t $TAG -o $TAG` to rebuild the absolute
minimal required set of images instead of cherry picking. This is not a bad idea given that the
Docker cache will be used and thus rebuilds of unchanged images is quick.

Lastly, you need to make sure that your new `orchest-api` image is used by minikube. This can be
done by deleting the respective `orchest-api` pod (which will automatically get replaced with a new
pod serving your updated image thanks to Kubernetes deployments):

```bash
# Kill the pods of the orchest-api, so that the new image gets used
# when new pod gets automatically deployed.
kubectl delete pods -n orchest -l "app.kubernetes.io/name=orchest-api"
```

Check out [k9s](https://github.com/derailed/k9s) if you want to use a visual interface instead
(highly recommended!).

````

````{tab-item} Multi node

The procedure for single-node is not possible in multi node deployments though. Since this is
slightly more involved, we provide the following scripts:

```bash
# Redeploy a service after building the image using the repo code.
# This is the script that you will likely use the most. This script
# assumes Orchest is installed and running, since it interacts with
# an Orchest service.
bash scripts/redeploy_orchest_service_on_minikube.sh orchest-api

# Remove an image from minikube. Can be useful to force a pull from
# a registry.
bash scripts/remove_image_from_minikube.sh orchest/orchest-api

# Build an image with a given tag, on all nodes.
bash scripts/build_image_in_minikube.sh orchest-api v2022.03.7

# Run arbitrary commands on all nodes.
bash scripts/run_in_minikube.sh echo "hello"
```

```{warning}
The redeploy and build_image scripts require the Orchest repository
{ref}`to be mounted in minikube <cluster-mount>`.
However, note that multi node mounting might not be supported by all minikube drivers.
We have tested with docker, the default driver.
```
````
`````

(dev-reinstalling-orchest)=

### Re-installing Orchest

When making larger changes or when wanting to check out a different branch for example, it is a good
idea to re-install Orchest. Rest assured, this should be fairly quick!

```bash
# Uninstall Orchest before proceeding
orchest uninstall

# Switch git branches if applicable
git switch feature-branch

# Rebuild containers, if needed
eval $(minikube -p minikube docker-env)
export TAG="$(orchest version --latest)"
scripts/build_container.sh -M -t $TAG -o $TAG

# Install Orchest again
orchest install --dev
```

## Making changes

(before-committing)=

### Before committing

Make sure your development environment is set up correctly
(see {ref}`prerequisites <development-prerequisites>`)
so that pre-commit can automatically take care of running the appropriate
formatters and linters when running `git commit`.

In our CI we also run a bunch of checks, such as unit tests and {ref}`integration tests <integration-tests>` to make sure the codebase remains stable. To read more about testing, check out
the {ref}`testing <tests>` section.

(opening-a-pr)=

### Opening a PR

```{note}
When opening a PR please change the base in which you want to merge from `master` to `dev`.
The [GitHub docs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/changing-the-base-branch-of-a-pull-request)
describe how this can be done.
```

We use [gitflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) as
our branching model with `master` and `dev` being the described `master` and `develop`
branches respectively. Therefore, we require PRs to be merged into `dev` instead of `master`.

When opening the PR a checklist will automatically appear to guide you to successfully completing
your PR 🏁

### Changing Python dependencies

Python dependencies for the microservices are specified using pip's `requirements.txt` files.
Those files are automatically generated by [pip-tools](https://pypi.org/project/pip-tools/)
from `requirements.in` files by calling `pip-compile`, which locks all the transitive
dependencies. After a locked `requirements.txt` file is in place,
subsequent calls to `pip-compile` will not upgrade any of the dependencies
unless the constraints in `requirements.in` are modified.

To manually upgrade a dependency to a newer version, there are several options:

```
pip-compile -P <dep>  # Upgrades <dep> to latest version
pip-compile -U  # Try to upgrade everything
```

As a general rule, avoid writing exact pins in `requirements.in`
unless there are known incompatibilities.
In addition, avoid manually editing `requirements.txt` files,
since they will be automatically generated.

````{warning}
A [bug in pip-tools](https://github.com/jazzband/pip-tools/issues/1505) affects local
dependencies. Older versions are not affected, but they are not compatible with modern pip.
At the time of writing, the best way forward is to install this fork
(see [this PR](https://github.com/jazzband/pip-tools/pull/1519) for details):

```
pip install -U "pip-tools @ git+https://github.com/richafrank/pip-tools.git@combine-without-copy"
```
````

### Database schema migrations

Whenever one of the services's database models (in their respective `models.py`) have been
changed, a database migration has to be performed so that all existing users are unaffected by the
schema change on update (since they can then be automatically migrated to the latest version).

```sh
# Depending on the service that requires schema changes.
scripts/migration_manager.sh orchest-api migrate
scripts/migration_manager.sh orchest-webserver migrate

# For more options run:
scripts/migration_manager.sh --help
```

(building-the-docs)=

### Building the docs

Our docs are built using [Read the Docs](https://docs.readthedocs.io/) with Sphinx and written
in [reStructuredText](https://www.sphinx-doc.org/en/master/usage/restructuredtext/basics.html).

To build the docs, run:

```bash
cd docs
make html
```

````{tip}
👉 If you didn't follow the {ref}`prerequisites <development-prerequisites>`, then make sure
you've installed the needed requirements to builds the docs:

```sh
python3 -m pip install -r docs/requirements.txt
```
````

## Example VS Code monorepo set-up

```{note}
👉 This section is for VS Code and [pyright](https://github.com/microsoft/pyright) users.
```

If you use VS Code (or the [pyright](https://github.com/microsoft/pyright) language server to be
more precise) then this section is for you. The different services contain their own
`pyrightconfig.json` file that configures smart features such as auto complete, go to definition,
find all references, and more. For this to work, you need to install the dependencies of the
services in the correct virtual environment by running:

```bash
scripts/run_tests.sh
```

Next you can create a workspace file that sets up VS Code to use the right Python interpreters (do
note that this won't include all the files defined in the Orchest repo), e.g.:

```json
{
  "folders": [
    {
      "path": "services/orchest-api"
    },
    {
      "path": "services/orchest-webserver"
    },
    {
      "path": "services/base-images/runnable-shared"
    },
    {
      "path": "services/session-sidecar"
    },
    {
      "name": "orchest-sdk",
      "path": "orchest-sdk/python"
    },
    {
      "name": "internal lib Python",
      "path": "lib/python/orchest-internals/"
    }
  ],
  "settings": {}
}
```

(tests)=

## Automated tests

(unit-tests)=

### Unit tests

Unit tests are being ported to k8s, stay tuned :)!

% The unit tests (in particular for the `orchest-api` and `orchest-webserver`) run against a real
% database. This, together with additional setup, and the running of all unit tests is done using the
% following script:
%
% `{sh} % scripts/run_tests.sh % `
%
% At this moment we only have unit tests for the Python code.
%
% .. tip::
% 👉 If you didn't follow the :ref:`prerequisites <development-prerequisites>`, then make sure
% you've installed the needed requirements to run the unit tests:
%
% `{sh} % sudo apt install default-libmysqlclient-dev % `
%
% .. note::
% For isolation dependencies for the different services are installed within their respective
% virtual environments inside the `.venvs` folder.

(integration-tests)=

### Integration tests

Integration tests are being ported to k8s, stay tuned :)!

% .. warning::
% 🚨 Running integration tests will remove all content of the `userdir` directory along with all
% built environments (the provided script will ask you to confirm before proceeding).
%
% ..
% The integration tests are build using [Cypress](http://cypress.io/) and can be run using:
%
% `{sh} % scripts/run_integration_tests.sh % `
%
% ..
% Running all the integration tests can take some time, depending on the host running the tests but
% also on the browser version, run-times have been observed to range from 15 to 30 minutes.
%
% ..
% .. tip::
% 👉 Adding the `-g` option opens the Cypress GUI. Use `--help` to see more options.
%
% Troubleshooting
% """""""""""""""
% The script takes care of starting Orchest if it isn't already. On the other hand, if Orchest is
% already started, then the script expects Orchest to be running on its default port `8000`.

## Manual testing

(environment-base-images-changes)=

### Test Environment or custom Jupyter base image changes

When building environment or custom Jupyter images the image builder mounts
the socket of the container runtime running on the node. This means that, to test changes
to a base image, all that is needed is to build or load the new base image in the
container runtime. Example:

```bash
# Make changes to services/base-images/base-kernel-py/Dockerfile, then:
eval $(minikube -p minikube docker-env)
bash scripts/build_container.sh -o v2022.08.11 -t v2022.08.11  -i base-kernel-py
# That's it, you can now build an environment image in Orchest using the
# new python base image.
```

Currently, this has only been tested with docker as the container runtime.

### Test running Orchest on `containerd`

To test running Orchest on `containerd`, we recommend [installing MicroK8s](https://microk8s.io/).
Alternatively, you can also set up Orchest on GKE (see {ref}`installation <regular-installation>`)
or install MicroK8s in a VM (e.g. using [VirtualBox](https://www.virtualbox.org/)).

Next, enable the following addons:

```bash
microk8s enable hostpath-storage \
    && microk8s enable dns \
    && microk8s enable ingress
```

Now that MicroK8s is correctly configured we need to rebuild Orchest's images and save them to a
`.tar` file so that `containerd` can unpack the file and use the images.

```bash
export TAG=v2022.06.4
scripts/build_container.sh -M -t $TAG -o $TAG
docker save \
    $(docker images | awk '{if ($1 ~ /^orchest\//) new_var=sprintf("%s:%s", $1, $2); print new_var}' | grep $TAG | sort | uniq) \
    -o orchest-images.tar
```

````{dropdown} 👉 I didn't install MicroK8s on my host
In case you didn't install MicroK8s on your host directly, you need to ship the images to the
MicroK8s node:
```bash
scp ./orchest-images.tar {your_user}@${microk8s node ip}:~/
```

And set up the kubeconfig on your host so that you can use the `orchest-cli` like:
```bash
KUBECONFIG=/path/to/kubeconfig orchest install --dev
```
````

Next, inside the MicroK8s node (which can be your host), you can import the images using:

```bash
microk8s ctr --namespace k8s.io --address /var/snap/microk8s/common/run/containerd.sock image import orchest-images.tar

# OR, requires ctr to be installed: https://github.com/containerd/containerd/releases
sudo ctr -n k8s.io -a /var/snap/microk8s/common/run/containerd.sock i import orchest-images.tar
```

Now you can install Orchest:

```bash
orchest install --dev --socket-path=/var/snap/microk8s/common/run/containerd.sock
```

### Run Orchest Controller locally

For easier debugging it is possible to run the `orchest-controller` locally with a debugger. We
will explain how to do so using VSCode. Make sure your cluster is set up and you've installed
[Go](https://go.dev/doc/install), then follow the steps below:

Run the `orchest-controller` with a debugger in VSCode, example `launch.json`:

```json
{
  "configurations": [
    {
      "name": "Launch ctrl",
      "type": "go",
      "request": "launch",
      "mode": "debug",
      "program": "${workspaceFolder}/cmd/controller/main.go",
      "args": [
        "--inCluster=false",
        "--defaultVersion=<INSERT VERSION, e.g. v2022.05.0>",
        "--assetsDir=${workspaceFolder}/deploy",
        "--endpoint=:5000"
      ],
      "env": {
        "KUBECONFIG": "~/.kube/config"
      }
    }
  ]
}
```

Next install Orchest and afterwards issue other commands to test the controller with:

```bash
# Asuming you are in the root of the orchest git repository
orchest install --dev

# Delete orchest-controller deployment so that the one started with
# the debugger does everything
kubectl delete -n orchest deploy orchest-controller
```

The Orchest Controller should now be running inside a debugger session.

#### Without using VSCode

Build the `orchest-controller` binary via the `Makefile` in `services/orchest-controller` and
run the `orchest-controller` by passing the following command line arguments:

```bash
# Asuming you have built the controller via "make controller" command
./bin/controller --inCluster=false --defaultVersion=v2022.05.3 \
--endpoint=:5000 --assetsDir=./deploy
```

### Test updating Orchest

#### Through the CLI

```bash
orchest uninstall
scripts/build_container.sh -M -t "v2022.04.4" -o "v2022.04.4"
orchest install --dev
scripts/build_container.sh -M -t "v2022.04.5" -o "v2022.04.5"
orchest update --dev --version=v2022.04.5
scripts/build_container.sh -M -t "v2022.04.6" -o "v2022.04.6"
orchest update --dev --version=v2022.04.6
```

#### Through the UI

For this to work you need to be running in dev mode and have the `orchest-dev-repo` mounted (as
per {ref}`setting up minikube for development <cluster-mount>`).

```bash
# Start from a clean slate so that we know what version we are on
# before invoking the update.
orchest uninstall

# Build whatever version you like! In case you want to test out
# the product after the update, build the X-1 latest release
# tag.
scripts/build_container.sh -m -t "v2022.04.4" -o "v2022.04.4"

# Installing and making sure running in dev.
orchest install --dev
orchest patch --dev
pnpm run dev

# Build the version to update to
scripts/build_container.sh -M -t "v2022.04.5" -o "v2022.04.5"

# Invoke the update through the UI go to:
# http://localorchest.io/update
...

# In case you want to test it again
scripts/build_container.sh -M -t "v2022.04.6" -o "v2022.04.6"
# Invoke the update through the UI go to:
# http://localorchest.io/update
...

# And repeat if you like.
```
