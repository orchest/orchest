# Ubuntu 20.04.1 LTS Focal
FROM jupyter/base-notebook:2022-03-09
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# Get Enterprise Gateway kernel files.
# - We don't need the `kernelspecs` because we mount custom kernelspecs
#   when starting a session.
# - We don't need `kernel_image_files` because we start kernels
#   externally (i.e. in Docker containers) and not inside the container
#   running the EG itself.
# - We don't use Spark so we don't need to install it.
ADD https://raw.githubusercontent.com/jupyter-server/enterprise_gateway/v2.5.2/etc/docker/enterprise-gateway/start-enterprise-gateway.sh /usr/local/bin/
ADD https://github.com/jupyter-server/enterprise_gateway/releases/download/v2.5.2/jupyter_enterprise_gateway-2.5.2-py3-none-any.whl /tmp/

USER root

RUN chown jovyan:users /usr/local/bin/start-enterprise-gateway.sh \
    && chmod 0755 /usr/local/bin/start-enterprise-gateway.sh \
    && mkdir -p /usr/local/share/jupyter \
    && touch /usr/local/share/jupyter/enterprise-gateway.log \
    && chmod 0666 /usr/local/share/jupyter/enterprise-gateway.log \
    && chown -R jovyan:users /usr/local/share/jupyter \
    && rm -f /usr/local/bin/bootstrap-kernel.sh

# Enterprise Gateway dependencies.
RUN mamba install --quiet --yes \
    cffi \
    send2trash \
    requests \
    future \
    pycryptodomex \
    && pip install --no-cache /tmp/jupyter_enterprise_gateway*.whl \
    && mamba clean --all -f -y \
    && fix-permissions $CONDA_DIR \
    && fix-permissions /home/$NB_USER

# Overwrite the standard Python 3 kernel to indicate it should not
# be used in Orchest.
COPY ./kernel-override/ /opt/conda/share/jupyter/kernels/python3/

COPY ./lib/python /orchest/lib/python
USER root
RUN pip3 install \
	--upgrade pip && \
	pip3 install -e /orchest/lib/python/orchest-internals && \
	pip3 install kubernetes==21.7.0

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}

USER $NB_UID

CMD ["/usr/local/bin/start-enterprise-gateway.sh"]

EXPOSE 8888

WORKDIR /usr/local/bin
