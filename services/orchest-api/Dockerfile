FROM tiangolo/uwsgi-nginx-flask:python3.7

RUN mkdir -p /orchest/orchest/orchest-api
COPY ./lib /orchest/lib
COPY ./app /orchest/orchest/orchest-api/app

# Setting this WORKDIR is required by the base image: "otherwhise uWSGI
# will try to run the app in /app".
WORKDIR /orchest/orchest/orchest-api/app
RUN pip3 install -r requirements.txt
