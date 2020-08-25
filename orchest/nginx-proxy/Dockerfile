FROM openresty/openresty:1.15.8.3-2-buster-nosse42

RUN apt-get update && apt-get install python3 -y

RUN mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.disabled

COPY ./*.conf* /etc/nginx/conf.d/

ARG enable_ssl=false
ARG self_signed_ssl=false
ARG domain=localhost

RUN mkdir -p /etc/ssl/certs/
COPY ./certs/* /etc/ssl/certs/
COPY ./generate-dummy-certs.sh /etc/ssl/certs/
COPY ./enable-ssl.py /etc/nginx/conf.d/

# generate dummy certificates
RUN if [ "${self_signed_ssl}" = true ] ; then \
    cd /etc/ssl/certs/ && \
    ./generate-dummy-certs.sh ; fi

# template inject ssl rules to orchest.conf
RUN if [ "${enable_ssl}" = true ] ; then \
    cd /etc/nginx/conf.d && \
    ./enable-ssl.py ${domain}; fi

RUN nginx -t
