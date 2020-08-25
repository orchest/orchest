FROM tiangolo/uwsgi-nginx-flask:python3.7

RUN makedir -p /orchest/orchest/orchest-api
COPY ./ /orchest/orchest/orchest-api/

# Setting this WORKDIR is required by the base image: "otherwhise uWSGI
# will try to run the app in /app".
WORKDIR /orchest/orchest/orchest-api/app
RUN pip3 install -r requirements.txt
