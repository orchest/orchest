FROM openresty/openresty:1.15.8.3-2-buster-nosse42

RUN mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.disabled

COPY ./orchest/nginx-proxy/orchest.conf /etc/nginx/conf.d/orchest.conf

RUN nginx -t
