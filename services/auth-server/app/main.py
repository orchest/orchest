from _orchest.internals import errors as _errors
from _orchest.internals import utils as _utils
from app import create_app
from config import CONFIG_CLASS

app = create_app(config_class=CONFIG_CLASS)

try:
    global_orchest_config = _utils.GlobalOrchestConfig()
except _errors.CorruptedFileError:
    app.logger.error("Failed to load global orchest config file.", exc_info=True)
else:
    global_orchest_config.save(flask_app=app)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80)
