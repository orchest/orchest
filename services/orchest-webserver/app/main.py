import subprocess

from app import create_app, create_app_managed

if __name__ == "__main__":

    with create_app_managed() as (app, socketio):
        app.logger.info(
            "Running orchest-webserver as %s"
            % subprocess.check_output("whoami", shell=True).decode().strip()
        )
        app.logger.info("Running from if __name__ == '__main__'")
        socketio.run(app, host="0.0.0.0", port=80, use_reloader=True, debug=True)

else:

    (app, socketio, processes) = create_app()
    app.logger.info(
        "Running orchest-webserver as %s"
        % subprocess.check_output("whoami", shell=True).decode().strip()
    )
    app.logger.info("Running from Gunicorn")
