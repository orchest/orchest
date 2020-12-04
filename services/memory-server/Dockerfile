FROM python:3.7-slim
LABEL maintainer="Orchest B.V. https://www.orchest.io"

# Get all requirements in place.
COPY ./requirements.txt /orchest/services/memory-server/
COPY ./lib /orchest/lib

# Set the `WORKDIR` so the editable installs in the `requirements.txt`
# can use relative paths.
WORKDIR /orchest/services/memory-server
RUN pip3 install -r requirements.txt

# Application files.
COPY ./app ./app

CMD ["python", "app/main.py"]
