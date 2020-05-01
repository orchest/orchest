# prompt sudo on first terminal
sudo ls

# source virtual env
source venv/bin/activate

gnome-terminal --geometry=154x84+0+0 -- "./run_orchest_api.sh" 

# sensible-browser http://127.0.0.1:8000 &> /dev/null &

DEBUG=true

if [ "$DEBUG" = true ] ; then
    echo "[Debug = true] starting webpack & sass watchers..."
    gnome-terminal --geometry=154x84+0+0 --working-directory=$PWD/orchest/webserver/orchest/static/ -- "./compile-js.sh" 
    gnome-terminal --geometry=154x84+0+0 --working-directory=$PWD/orchest/webserver/orchest/static/css/ -- "./compile-sass.sh" 
fi


## Run orchest web interface
cd $PWD/orchest/webserver
python app.py