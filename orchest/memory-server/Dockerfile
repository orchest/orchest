FROM python:3.7-stretch

ARG sdk_branch=master

# Installing the requirements here before copying, allows us to faster
# rebuild containers by using the cache.
RUN pip3 install networkx==2.4 \
    git+https://github.com/orchest/orchest-sdk.git@${sdk_branch}#subdirectory=python

COPY ./app /app

WORKDIR /app

CMD ["python", "main.py", "-p", "/notebooks/pipeline.json"]
