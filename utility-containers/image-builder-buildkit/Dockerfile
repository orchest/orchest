FROM moby/buildkit:latest
LABEL maintainer="Orchest B.V. https://www.orchest.io"
RUN	buildkitd --version && buildctl --version && \
	apk add rsync openssh-server && ssh-keygen -A && \
	# To ssh from the jupyter server container while building to be
	# able to write to jupyter settings.
	echo -e "root\nroot" | passwd root && \
	echo "PermitRootLogin yes" >> /etc/ssh/sshd_config