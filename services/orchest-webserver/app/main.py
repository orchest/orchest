#!/usr/bin/env python3

import logging
import sys

logging.basicConfig(stream=sys.stdout, level=logging.INFO)

from app import create_app, create_app_managed

if __name__ == "__main__":

    with create_app_managed() as (app, socketio):
        logging.info("Running from if __name__ == '__main__'")
        socketio.run(app, host="0.0.0.0", port=80, use_reloader=True, debug=True)

else:

    (app, socketio, processes) = create_app()
    logging.info("Running from Gunicorn")
