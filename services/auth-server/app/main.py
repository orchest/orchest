from _orchest.internals import utils as _utils
from app import create_app
from config import CONFIG_CLASS

app = create_app(config_class=CONFIG_CLASS)
config = _utils.GlobalOrchestConfig()
config.save(flask_app=app)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80)
