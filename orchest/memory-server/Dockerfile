FROM python:3.7-stretch

# Installing the requirements here before copying, allows us to faster
# rebuild containers by using the cache.
RUN pip3 install git+https://github.com/orchest/orchest-sdk.git@master#subdirectory=python \
    networkx==2.4

COPY ./app /app

WORKDIR /app

# In case we forgot to update the first RUN command accordingly to the
# new requirements. Note that pip will not reinstall already installed
# packages.
RUN pip3 install -r requirements.txt

CMD ["python", "main.py"]
