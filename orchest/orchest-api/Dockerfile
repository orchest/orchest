FROM tiangolo/uwsgi-nginx-flask:python3.7

# We can simply copy the entire build context, because in the 
# dockerignore we specified precisely what we want to include in the
# image.
COPY ./ /orchest/

# Setting this WORKDIR is required by the base image: "otherwhise uWSGI
# will try to run the app in /app".
WORKDIR /orchest/orchest/orchest-api/app
RUN pip3 install -r requirements.txt
