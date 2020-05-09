# prompt sudo on first terminal
sudo ls 1> /dev/null

## Prepare docker container sock file for in-container docker spawning
sudo chmod 0777 /var/run/docker.sock

source kill_orchest.sh

docker container prune -f

# source virtual env
source run_orchest_api.sh

# sensible-browser http://127.0.0.1:8000 &> /dev/null &

DEBUG=true

if [ "$DEBUG" = true ] ; then
    echo "[Debug = true] starting webpack & sass watchers..."
    gnome-terminal --geometry=154x84+0+0 --working-directory=$PWD/orchest/webserver/app/static/ -- "./compile-js.sh" 
    gnome-terminal --geometry=154x84+0+0 --working-directory=$PWD/orchest/webserver/app/static/css/ -- "./compile-sass.sh" 
fi


## Run orchest web interface
#docker run -d -e HOST_USER_DIR=$PWD/orchest/userdir -v $PWD/orchest/webserver/app:/app -v $PWD/orchest/userdir:/userdir --name=orchest-webserver --network=orchest orchest-webserver

docker run -d -e HOST_USER_DIR=$PWD/orchest/userdir -e FLASK_DEBUG=1 -e FLASK_APP=app -v $PWD/orchest/webserver/app:/app -v $PWD/orchest/userdir:/userdir --name=orchest-webserver --network=orchest orchest-webserver flask run --host=0.0.0.0 --port=80

# spawn browser for docker container running webserver
IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' orchest-webserver)

sensible-browser "http://$IP" > /dev/null 2>&1 # supress browser warnings/errors