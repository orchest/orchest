FROM tiangolo/uwsgi-nginx-flask:python3.7

# Get the orchest application, specifically the auth-server
RUN mkdir -p /orchest/orchest/orchest-update-server/
COPY ./ /orchest/orchest/orchest-update-server

WORKDIR /orchest/orchest/orchest-update-server/app

COPY ./override.conf /app/nginx.conf

RUN pip3 install -r requirements.txt