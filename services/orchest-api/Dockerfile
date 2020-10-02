FROM tiangolo/uwsgi-nginx-flask:python3.7

RUN mkdir -p /orchest/services/orchest-api
COPY ./lib /orchest/lib
COPY ./app /orchest/services/orchest-api/app

# Setting this WORKDIR is required by the base image: "otherwhise uWSGI
# will try to run the app in /app".
WORKDIR /orchest/services/orchest-api/app
RUN pip3 install -r requirements.txt
