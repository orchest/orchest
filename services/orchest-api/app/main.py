from app import create_app
from config import CONFIG_CLASS
import subprocess
import sys
import logging

logging.basicConfig(stream=sys.stdout, level=logging.INFO)

app = create_app(config_class=CONFIG_CLASS)
logging.info(
    "Running orchest-api as %s" % subprocess.check_output("whoami", shell=True).decode()
)

if __name__ == "__main__":
    app.run(host="0.0.0.0")
