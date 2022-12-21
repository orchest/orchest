from flask import Blueprint
from flask_restx import Api

from app.apis.namespace_auth_users import api as ns_auth_users
from app.apis.namespace_ctl import api as ns_ctl
from app.apis.namespace_environment_image_builds import api as ns_env_image_builds
from app.apis.namespace_environment_images import api as ns_env_images
from app.apis.namespace_environment_shells import api as ns_environment_shells
from app.apis.namespace_environments import api as ns_envs
from app.apis.namespace_git_imports import api as ns_git_imports
from app.apis.namespace_info import api as ns_info
from app.apis.namespace_jobs import api as ns_jobs
from app.apis.namespace_jupyter_image_builds import api as ns_jupyter_image_builds
from app.apis.namespace_notifications import api as ns_notifications
from app.apis.namespace_pipelines import api as ns_pipelines
from app.apis.namespace_projects import api as ns_projects
from app.apis.namespace_runs import api as ns_runs
from app.apis.namespace_services import api as ns_services
from app.apis.namespace_sessions import api as ns_sessions
from app.apis.namespace_snapshots import api as ns_snapshots
from app.apis.namespace_validations import api as ns_validations

blueprint = Blueprint("api", __name__)

api = Api(
    blueprint,
    title="Orchest API",
    version="1.0",
    description="Back-end API for Orchest",
)

api.add_namespace(ns_auth_users)
api.add_namespace(ns_ctl)
api.add_namespace(ns_env_image_builds)
api.add_namespace(ns_env_images)
api.add_namespace(ns_environment_shells)
api.add_namespace(ns_envs)
api.add_namespace(ns_git_imports)
api.add_namespace(ns_info)
api.add_namespace(ns_jobs)
api.add_namespace(ns_jupyter_image_builds)
api.add_namespace(ns_notifications)
api.add_namespace(ns_pipelines)
api.add_namespace(ns_projects)
api.add_namespace(ns_runs)
api.add_namespace(ns_services)
api.add_namespace(ns_sessions)
api.add_namespace(ns_snapshots)
api.add_namespace(ns_validations)
