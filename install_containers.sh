# JupyterLab server
docker build -t jupyter-server orchest/jupyter-server

# Enterprise Gateway used for docker based kernels in JupyterLab
docker pull elyra/enterprise-gateway:2.1.0

# kernel images for Enterprise Gateway Notebook kernels
docker pull elyra/kernel-py:2.0.0
docker pull elyra/kernel-r:2.0.0
