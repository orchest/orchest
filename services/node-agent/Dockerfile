FROM python:3.8-slim
LABEL maintainer="Orchest B.V. https://www.orchest.io"

WORKDIR /orchest/services/node-agent/

# Get all Python requirements in place and install them.
COPY . ./
RUN pip3 install -r requirements.txt

CMD [ "python3", "./app/main.py" ]
