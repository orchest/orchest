from flask_migrate import MigrateCommand
from flask_script import Manager

from app import create_app

# Used to issue migration commands to a running service (container),
# e.g. kubectl exec commands. See /scripts/migration_manager.sh for more
# info.

if __name__ == "__main__":
    app, _, _ = create_app(to_migrate_db=True)
    manager = Manager(app)
    manager.add_command("db", MigrateCommand)
    manager.run()
