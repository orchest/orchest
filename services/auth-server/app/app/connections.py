from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import MetaData

from _orchest.internals import config

# this will make it so that constraints and indexes follow a certain
# naming pattern
metadata = MetaData(naming_convention=config.database_naming_convention)
db = SQLAlchemy(metadata=metadata)
