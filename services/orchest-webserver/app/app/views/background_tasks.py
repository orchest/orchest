from flask import jsonify

def register_background_tasks_view(app, db):

    @app.route("/async/background-tasks/<task_uuid>", methods=["GET"])
    def get_background_task(task_uuid):
        # TODO: implement actual task status
        return jsonify({
            "status": "SUCCESS",
            "result": "Finished importing the git project."
        })