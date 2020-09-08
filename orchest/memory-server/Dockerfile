FROM python:3.7-slim

RUN mkdir -p /orchest/orchest/memory-server
COPY ./ /orchest/orchest/memory-server/
RUN mv /orchest/orchest/memory-server/lib /orchest/lib \
    && mv /orchest/orchest/memory-server/orchest-sdk /orchest/orchest-sdk

WORKDIR /orchest/orchest/memory-server
RUN pip3 install -r requirements.txt

CMD ["python", "app/main.py"]
