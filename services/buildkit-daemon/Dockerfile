FROM moby/buildkit:v0.10.4
LABEL maintainer="Orchest B.V. https://www.orchest.io"
ADD buildkitd.toml /etc/buildkit/buildkitd.toml
ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
ENTRYPOINT [ "/usr/bin/buildkitd" ]
CMD ["--addr", "unix:///run/orchest_buildkit/buildkitd.sock"]
