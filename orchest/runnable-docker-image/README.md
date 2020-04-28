## Runnable Docker Image

This folder contains the runnable docker image that can execute.

It currently supports executing Jupyter notebooks (.ipynb), Python scripts and shell scripts.

### Building
`docker build -t pipeline-step-runner .`

### Testing

To test whether it's correctly executing run one of the following commands:

`docker run -v $PWD/notebooks/:/notebooks pipeline-step-runner sample-notebook.ipynb`

`docker run -v $PWD/notebooks/:/notebooks pipeline-step-runner hello.py`

`docker run -v $PWD/notebooks/:/notebooks pipeline-step-runner hello.sh`

### Base image

The image is based on the same `jupyter/scipy-notebook` image as the Enterprise Gateway `kernel-py` image (https://github.com/jupyter/enterprise_gateway/blob/master/etc/docker/kernel-py/Dockerfile).