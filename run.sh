# prompt sudo on first terminal
sudo ls

# source virtual env
source venv/bin/activate

gnome-terminal -- "./run_orchest_api.sh"

# sensible-browser http://127.0.0.1:8000 &> /dev/null &

DEBUG=true

if [ "$DEBUG" = true ] ; then
    echo "[Debug = true] starting webpack & sass watchers..."
    gnome-terminal --working-directory=/home/rick/workspace/orchest/orchest/webserver/orchest/static/ -- "./compile-js.sh"
    gnome-terminal --working-directory=/home/rick/workspace/orchest/orchest/webserver/orchest/static/css/ -- "./compile-sass.sh"
fi


## Run orchest web interface
cd /home/rick/workspace/orchest/orchest/webserver
python app.py