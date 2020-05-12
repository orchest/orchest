<img src='orchest-logo.png' width="250px" />

#

Today, the process of training, deploying and monitoring machine learning models using projects like Kubeflow is
complex. Orchest is building a machine learning pipeline product that lets data scientists focus on building models, not
managing infrastructure. 

Our platform makes it easy for data science teams to iteratively develop standardized data
science pipelines. Through integration with common data sources and a simple API for model deployment we make
productionizing machine learning models in web & mobile applications a breeze. 

Features
========
* Build pipelines in our visual interface
* Use built-in data sources
* Collaborate on the same project
* Develop your code on the platform or upload files
* Debug your notebooks in Visual Studio Code
* Run on the cloud and specify compute
* Pick what cells you want to run from your notebooks. Perfect for prototyping as you do not have to maintain a perfectly clean notebook.
* Manage and snapshot your code and data to restore previous versions
* Author experiments by specifying key-value pairs

Orchest is an open source end-to-end machine learning platform tailored to web & mobile applications.

# Running Orchest for development

# TODO: update this
1. Install virtualenv and create a virtual environment in this directory `venv/` by running `virtualenv venv`.
2. Install requirements.txt in virtualenv from orchest/webserver/requirements.txt
2. Install requirements.txt in virtualenv from orchest/orchest-api/requirements.txt
3. Install nodejs / npm
4. Run npm install in orchest/webserver/static/
5. Build front-end JS `npx webpack` in orchest/webserver/static/
6. Run `install_orchest.py` to create the Docker network
7. Build jupyter-server docker image in orchest/jupyter-server/ `docker build -t "jupyter-server" .`
