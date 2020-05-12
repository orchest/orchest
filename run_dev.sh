# prompt sudo on first terminal
source orchest.sh stop
source orchest.sh start debug

DEBUG=true

if [ "$DEBUG" = true ] ; then
    echo "[Debug = true] starting webpack & sass watchers..."
    gnome-terminal --geometry=154x84+0+0 --working-directory=$PWD/orchest/orchest-webserver/app/static/ -- "./compile-js.sh" 
    gnome-terminal --geometry=154x84+0+0 --working-directory=$PWD/orchest/orchest-webserver/app/static/css/ -- "./compile-sass.sh" 
fi