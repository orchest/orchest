FROM elyra/enterprise-gateway:2.3.0

COPY ./lib /orchest/lib

COPY ./app /orchest/services/jupyter-enterprise-gateway/app
WORKDIR /orchest/services/jupyter-enterprise-gateway/app

USER root
RUN pip3 install --upgrade pip
RUN pip3 install -r requirements.txt
USER $NB_UID