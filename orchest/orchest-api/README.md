# Container manga

## RabbitMQ
To start the my-rabbit node (the port `5672` is automatically published):
```bash
docker run -d --hostname my-rabbit --network orchest --name rabbitmq-server rabbitmq:3
```

Check the IP of the container
```bash
docker network inspect <network-name>
```

(---- no longer needed, because we use host names ----)

Connect Celery to RabbitMQ (lets say the IP is X)
```bash
broker_url = 'ampq://guest:guest@X:5672//'
```
(where `guest:guest` is the default `user:password` of the `rabbitmq:3`)

(-----------------------------------------------------)

To start the web-based UI run
1. Enable the management plugins (inside the container)
        `docker exec -it some-rabbit bash`
   Then run
        `rabbitmq-plugins enable rabbitmq_management`
2. Now we can connect to it using our web-browser on:
        `http://X:15672`
3. And login again with `guest` and `guest`


## Celery worker
We want to spawn docker from inside docker
```bash
sudo chmod -R 0777 /var/run/docker.sock 
```

Building with non-default dockerfile name
```bash
docker build -t celery-worker -f Dockerfile_celery .
```

Running container (with the docker.sock mount)
```bash
docker run -v /var/run/docker.sock:/var/run/docker.sock --network orchest --name celery-worker celery-worker
```


## Orchest API
Building can be done via
```bash
docker build -t orchest-api .
```

Run (uwsgi automatically listens on port 80)
```bash
docker run --network orchest --name orchest-api orchest-api
```

