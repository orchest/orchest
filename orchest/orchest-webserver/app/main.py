#!/usr/bin/env python3

import logging
import sys

logging.basicConfig(stream=sys.stdout, level=logging.INFO)

from app import create_app

with create_app() as (app, socketio):
    
    if __name__ == '__main__':
        logging.info("Running from if __name__ == '__main__'")
        socketio.run(app, host='0.0.0.0', port=80, use_reloader=True, debug=True)