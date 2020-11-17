FROM openresty/openresty:1.15.8.3-2-buster-nosse42
LABEL maintainer="Orchest B.V. https://www.orchest.io"

RUN apt-get update && apt-get install python3 -y

RUN mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.disabled

COPY ./*.conf* /etc/nginx/conf.d/

COPY ./certs/* /etc/ssl/certs/
COPY ./generate-dummy-certs.sh /etc/ssl/certs/

# generate dummy certificates
RUN cd /etc/ssl/certs/ && \
    ./generate-dummy-certs.sh

RUN nginx -t
