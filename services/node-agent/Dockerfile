FROM python:3.8-slim
LABEL maintainer="Orchest B.V. https://www.orchest.io"

WORKDIR /orchest/services/node-agent/

# Get all Python requirements in place and install them.
COPY ./requirements.txt ./
COPY ./lib /orchest/lib

RUN pip3 install -r requirements.txt

COPY . ./

CMD [ "python3", "./app/main.py" ]
ARG ORCHEST_VERSION
ENV ORCHEST_VERSION=${ORCHEST_VERSION}
