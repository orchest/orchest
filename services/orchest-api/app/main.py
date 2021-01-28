import subprocess

from config import CONFIG_CLASS

from app import create_app

app = create_app(config_class=CONFIG_CLASS, be_scheduler=True)

app.logger.info(
    "Running orchest-api as %s"
    % subprocess.check_output("whoami", shell=True).decode().strip()
)

if __name__ == "__main__":
    app.run(host="0.0.0.0")
