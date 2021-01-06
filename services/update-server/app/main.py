import json
import logging
import sys

from config import CONFIG_CLASS

from app import create_app

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)

app = create_app(config_class=CONFIG_CLASS)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80)
