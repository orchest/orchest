FROM python:3.7-slim
LABEL maintainer="Orchest B.V. https://www.orchest.io"

COPY ./ /orchest/services/memory-server/
RUN mv /orchest/services/memory-server/lib /orchest/lib

WORKDIR /orchest/services/memory-server
RUN pip3 install -r requirements.txt

CMD ["python", "app/main.py"]
