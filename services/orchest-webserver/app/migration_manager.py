import sys

from flask_migrate import Migrate

from app import create_app
from app.connections import db

# Used to issue migration commands to a running service (container),
# e.g. kubectl exec commands. See /scripts/migration_manager.sh for more
# info.

if "flask db" in " ".join(sys.argv):
    app, _, _ = create_app(to_migrate_db=True)
    # Necessary for DB migrations.
    migrate = Migrate(app, db)
