# source virtual env
source venv/bin/activate

gnome-terminal -- "./run_orchest_api.sh"

sensible-browser http://127.0.0.1:8000 &> /dev/null &

## Run orchest web interface
cd /home/rick/workspace/orchest/orchest/webserver
python app.py
