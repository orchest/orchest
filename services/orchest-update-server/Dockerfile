FROM tiangolo/meinheld-gunicorn-flask:python3.7

# Get the orchest application, specifically the auth-server
RUN mkdir -p /orchest/orchest/update-server/
COPY ./ /orchest/orchest/update-server

WORKDIR /orchest/orchest/update-server/app

RUN pip3 install -r requirements.txt