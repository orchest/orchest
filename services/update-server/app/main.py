import logging
import sys

from app import create_app

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80)
