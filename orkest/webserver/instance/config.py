import os

SQLALCHEMY_DATABASE_URI = "sqlite:///../orkest/db/development.db"
SQLALCHEMY_TRACK_MODIFICATIONS = False

dir_path = os.path.dirname(os.path.realpath(__file__))

ROOT_DIR = os.path.join(dir_path, "../../")

RESOURCE_DIR = os.path.join(dir_path, "../orkest/res/")
