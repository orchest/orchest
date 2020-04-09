# orchest

Orchest is an open source end-to-end machine learning platform tailored to web & mobile applications.

# Running Orchest for development

1. Install virtualenv and create a virtual environment in this directory `venv/` by running `virtualenv venv`.
2. Install requirements.txt in virtualenv from orchest/webserver/requirements.txt
2. Install requirements.txt in virtualenv from orchest/orchest-api/requirements.txt
3. Install nodejs / npm
4. Run npm install in orchest/webserver/static/
5. Build front-end JS `npx webpack` in orchest/webserver/static/
6. Run `install_orchest.py` to create the Docker network
7. Build jupyter-server docker image in orchest/jupyter-server/ `docker build -t "jupyter-server" .`