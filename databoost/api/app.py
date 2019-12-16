from flask import Flask

from apis import blueprint as api


app = Flask(__name__)
app.config.from_object('config')
app.register_blueprint(api, url_prefix='/api')


if __name__ == '__main__':
    app.run()
