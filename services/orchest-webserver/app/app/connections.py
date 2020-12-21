from flask_marshmallow import Marshmallow
from sqlalchemy import MetaData
from flask_sqlalchemy import SQLAlchemy

from _orchest.internals import config as _config

# this will make it so that constraints and indexes follow a certain
# naming pattern
metadata = MetaData(naming_convention=_config.database_naming_convention)
ma = Marshmallow()
