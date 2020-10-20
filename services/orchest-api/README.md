# Orchest API

The Orchest API serves as the back-end for the Orchest platform. It is responsible for executing
and managing pipelines (and storing their states). In addition, it manages the Jupyter environment
that allows the user to edit their notebooks within Orchest.

## orchest-api

Container running the Flask API.

## celery-worker

Container running the Celery worker that receives background tasks from the `orchest-api`. An
additional container running RabbitMQ is run to serve as a broker between the API and Celery.
