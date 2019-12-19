Commands to build and run the docker container
```
docker build -t "jupyter-server" .
docker rm $(docker ps -a -q)
docker run --name mytest -p 8888:8888 -p 80:80 -v /Users/yannick/Documents/projects/Databoost/notebooks:/notebooks jupyter-server:latest
```

Example POST request to the jupyter server container
```
{
  "gateway-url": "http://0.0.0.0:8889",
}

Hard coded settings
* ip=0.0.0.0
* port=8888
* notebook-dir=/notebooks

API will always run on port=80

Jupyter Server is started via a subprocess and shutdown via http://localhost:8888/api/shutdown

Jupyter Enterprise Gateway always runs on port=8888 and ip=0.0.0.0