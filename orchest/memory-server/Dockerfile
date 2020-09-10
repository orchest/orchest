FROM python:3.7-slim

RUN mkdir -p /orchest/orchest/memory-server
COPY ./ /orchest/orchest/memory-server/
RUN mv /orchest/orchest/memory-server/lib /orchest/lib

WORKDIR /orchest/orchest/memory-server
RUN pip3 install -r requirements.txt

CMD ["python", "app/main.py"]
