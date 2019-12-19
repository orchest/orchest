from flask import Flask

from apis import blueprint as api
from connections import db


app = Flask(__name__)
app.config.from_object('config')
app.register_blueprint(api, url_prefix='/api')

# Initialize the database and create the database file.
db.init_app(app)
with app.app_context():
    db.create_all()


if __name__ == '__main__':
    app.run()
