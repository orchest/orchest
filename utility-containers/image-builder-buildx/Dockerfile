FROM docker:20.10.18
LABEL maintainer="Orchest B.V. https://www.orchest.io"
COPY --from=docker/buildx-bin:0.9.1 /buildx /usr/libexec/docker/cli-plugins/docker-buildx
RUN	docker buildx version && \
	apk add rsync openssh-server && ssh-keygen -A && \
	# To ssh from the jupyter server container while building to be
	# able to write to jupyter settings.
	echo -e "root\nroot" | passwd root && \
	echo "PermitRootLogin yes" >> /etc/ssh/sshd_config
