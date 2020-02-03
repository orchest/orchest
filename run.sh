# source virtual env
source venv/bin/activate

gnome-terminal -- "./run_orchest_api.sh"

## Run orchest web interface
cd /home/rick/workspace/orchest/orchest/webserver
python app.py

