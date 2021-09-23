FROM openresty/openresty:1.19.3.1-3-buster
LABEL maintainer="Orchest B.V. https://www.orchest.io"

RUN mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.disabled

# Add environment variable
RUN echo "\nenv ENABLE_SSL;" >> /usr/local/openresty/nginx/conf/nginx.conf

COPY ./orchest.conf /etc/nginx/conf.d/
COPY ./*.conf /usr/local/openresty/nginx/conf/

COPY ./certs/* /etc/ssl/certs/
COPY ./generate-dummy-certs.sh /etc/ssl/certs/

# generate dummy certificates
RUN cd /etc/ssl/certs/ && \
    ./generate-dummy-certs.sh

ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
RUN nginx -t
