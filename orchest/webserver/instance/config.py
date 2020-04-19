import os

SQLALCHEMY_DATABASE_URI = "sqlite:///../orchest/db/development.db"
SQLALCHEMY_TRACK_MODIFICATIONS = False

dir_path = os.path.dirname(os.path.realpath(__file__))

ROOT_DIR = os.path.join(dir_path, "../../")
ORCHEST_API_ADDRESS = "172.31.0.1:5000"

RESOURCE_DIR = os.path.join(dir_path, "../orchest/res/")
