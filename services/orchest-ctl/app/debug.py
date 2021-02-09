import json
import os
from functools import reduce
from typing import Set

from docker.errors import NotFound

from app import utils
from app.config import _on_start_images
from app.docker_wrapper import DockerWrapper
from app.orchest_resource_manager import OrchestResourceManager

health_check_command = {
    # Works locally, doesn't work here.
    # "orchest/nginx-proxy:latest": 'service --status-all |
    # grep openresty',
    "orchest/orchest-api:latest": "wget localhost/api --spider",
    "orchest/orchest-webserver:latest": "wget localhost --spider",
    "orchest/auth-server:latest": "wget localhost/auth --spider",
    "orchest/celery-worker:latest": "celery inspect ping -A app.core.tasks",
    "orchest/file-manager:latest": "wget localhost --spider",
    "postgres:13.1": "pg_isready --username postgres",
    "rabbitmq:3": "rabbitmqctl node_health_check",
}


def health_check():
    """

    Returns:
        Dict mapping container names to health check exit codes.
    """
    (
        running_containers_ids,
        running_containers_names,
    ) = OrchestResourceManager().get_containers(state="running")

    cmds = []

    # Run health checks for containers that do have one.
    for id, container in zip(running_containers_ids, running_containers_names):
        hcheck = health_check_command.get(container)
        if hcheck is not None:
            cmds.append([id, hcheck])

    exit_codes = DockerWrapper().exec_runs(cmds)
    container_to_code = {}
    for container, code in zip(running_containers_names, exit_codes):
        container_to_code[container] = code

    return container_to_code


def database_debug_dump(
    path: str, dbs=["auth_server", "orchest_api", "orchest_webserver"]
):
    """Get database schema, revision version, rows per table(s)."""

    docker_wrapper = DockerWrapper()

    try:
        container = docker_wrapper.get_container("orchest-database")
        container_id = container.id

        if container.status != "running":
            utils.echo("\tThe orchest-database is not running.")
            return

    except NotFound:
        utils.echo("\tThe orchest-database is not running.")
        return

    db_debug_dump_directory = os.path.join(path, "database")
    if not os.path.exists(db_debug_dump_directory):
        os.mkdir(db_debug_dump_directory)

    cmds = []
    files_to_copy = []

    for db in dbs:

        # Schema of the db.
        filename = f"{db}_schema.sql"
        cmds.append(
            (
                container_id,
                f"pg_dump --user postgres -d {db}" f" --schema-only -f {filename}",
            )
        )
        files_to_copy.append(
            (container_id, filename, os.path.join(db_debug_dump_directory, filename))
        )

        # Alembic version.
        filename = f"{db}_alembic_version.sql"
        cmds.append(
            (
                container_id,
                (
                    f'psql --user postgres -d {db} -c "SELECT * '
                    f'FROM alembic_version;" -o {filename}'
                ),
            )
        )
        files_to_copy.append(
            (container_id, filename, os.path.join(db_debug_dump_directory, filename))
        )

        # Row counts of each table in the db.
        filename = f"{db}_counts.sql"
        cmds.append(
            (
                container_id,
                (
                    f'psql --user postgres -d {db} -c "'
                    """
            select table_schema, table_name,
                (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
            from (
                select table_name, table_schema,
                query_to_xml(format('select count(*) as cnt from %I.%I',
                table_schema, table_name), false, true, '') as xml_count
            from information_schema.tables
            where table_schema = 'public') t
            """
                    f'" -o {filename}'
                ),
            )
        )
        files_to_copy.append(
            (container_id, filename, os.path.join(db_debug_dump_directory, filename))
        )

    exit_codes = docker_wrapper.exec_runs(cmds)
    # Do not attempt to copy files which related command had errors.
    files_to_copy = [
        files_to_copy[i] for i, exit_code in enumerate(exit_codes) if exit_code == 0
    ]
    docker_wrapper.copy_files_from_containers(files_to_copy)


def celery_debug_dump(path: str):
    """Worker logs and output of celery inspect commands."""

    docker_wrapper = DockerWrapper()

    try:
        container = docker_wrapper.get_container("celery-worker")
        if container.status != "running":
            utils.echo(
                (
                    "\tThe celery-worker container is not running, the debug "
                    "data will be incomplete."
                )
            )
    except NotFound:
        utils.echo(
            (
                "\tCould not find the celery-worker container. "
                "That means that it is not running nor stopped, e.g. it "
                "has never been run or it was removed when stopping Orchest."
            )
        )
        return

    container = docker_wrapper.get_container("celery-worker")
    cel_debug_dump_directory = os.path.join(path, "celery")

    if not os.path.exists(cel_debug_dump_directory):
        os.mkdir(cel_debug_dump_directory)

    files_to_copy = []

    if container.status == "running":
        # Run inspection commands and get the result.
        cmd_template = "celery inspect -A app.core.tasks {name} > {name}.txt"
        cmds = []

        for inspect_command in [
            "active",
            "active_queues",
            "conf",
            "revoked",
            "report",
            "reserved",
            "scheduled",
            "stats",
        ]:
            cmd = cmd_template.format(name=inspect_command)
            # Necessary work around to avoid errors of the python docker
            # SDK.
            cmd = ["/bin/sh", "-c", cmd]
            cmds.append((container.id, cmd))
            files_to_copy.append(
                (
                    container.id,
                    f"/orchest/services/orchest-api/app/{inspect_command}.txt",
                    os.path.join(cel_debug_dump_directory, f"{inspect_command}.txt"),
                )
            )

        exit_codes = docker_wrapper.exec_runs(cmds)
        # Do not attempt to copy files which related command had errors.
        files_to_copy = [
            files_to_copy[i] for i, exit_code in enumerate(exit_codes) if exit_code == 0
        ]

    # Add log files to the files to copy.
    for worker in [
        "celery_env_builds",
        "celery_interactive",
        "celery_jobs",
    ]:
        files_to_copy.append(
            (
                container.id,
                f"/orchest/services/orchest-api/app/{worker}.log",
                os.path.join(cel_debug_dump_directory, f"{worker}.log"),
            )
        )

    docker_wrapper.copy_files_from_containers(files_to_copy)


def websever_debug_dump(path):
    """Get the webserver log file."""

    docker_wrapper = DockerWrapper()
    try:
        container_id = docker_wrapper.get_container("orchest-webserver").id
    except NotFound:
        utils.echo(
            (
                "\tCould not find the orchest-webserver container. "
                "That means that it is not running nor stopped, e.g. it "
                "has never been run or it was removed when stopping Orchest."
            )
        )
        return

    web_debug_dump_directory = os.path.join(path, "webserver")
    if not os.path.exists(web_debug_dump_directory):
        os.mkdir(web_debug_dump_directory)

    docker_wrapper.copy_files_from_containers(
        [
            (
                container_id,
                "/orchest/services/orchest-webserver/app/orchest-webserver.log",
                os.path.join(web_debug_dump_directory, "orchest-webserver.log"),
            )
        ]
    )


def containers_logs_dump(path):
    """Get the logs of every Orchest container, except steps."""

    containers_logs = os.path.join(path, "containers-logs")
    if not os.path.exists(containers_logs):
        os.mkdir(containers_logs)

    docker_wrapper = DockerWrapper()
    ids, names = docker_wrapper.get_containers(state="all", network="orchest")

    orchest_set: Set[str] = reduce(lambda x, y: x.union(y), _on_start_images, set())
    session_containers = {
        "orchest/jupyter-server:latest",
        "orchest/jupyter-enterprise-gateway",
        "orchest/memory-server:latest",
    }

    for id, name in zip(ids, names):
        if name in orchest_set:
            file_name = f"{name}.txt"
        elif name in session_containers:
            file_name = f"{name}-{id}.txt"
        # Do not pickup containers that are running user pipeline
        # steps, to avoid the risk of getting user data through its
        # logs.
        else:
            continue

        # Else orchest/<something> won't work as a file name in
        # os.path.join.
        file_name = file_name.replace("orchest/", "")
        container = docker_wrapper.get_container(id)
        logs = container.logs()

        with open(os.path.join(containers_logs, file_name), "wb") as file:
            file.write(logs)


def containers_version_dump(path):
    """Get the version of Orchest containers"""

    with open(os.path.join(path, "containers_version.txt"), "w") as file:
        for name, version in OrchestResourceManager().containers_version().items():
            file.write(f"{name:<44}: {version}\n")


def orchest_config_dump(path):
    """Get the Orchest config file, with telemetry UUID removed"""

    # Copy the config
    with open("/config/config.json") as input_json_file:
        config = json.load(input_json_file)
        # Removed for privacy.
        del config["TELEMETRY_UUID"]

        with open(os.path.join(path, "config.json"), "w") as output_json_file:
            json.dump(config, output_json_file)


def health_check_dump(path):
    with open(os.path.join(path, "health_check.txt"), "w") as file:
        for container, exit_code in health_check().items():
            file.write(f"{container:<44}: {exit_code}\n")


def running_containers_dump(path):
    """Get which Orchest containers are running"""

    _, running_containers_names = OrchestResourceManager().get_containers(
        state="running"
    )
    with open(os.path.join(path, "running_containers.txt"), "w") as file:
        for name in running_containers_names:
            file.write(f"{name}\n")


def debug_dump(compress: bool):

    debug_dump_path = "/tmp/debug-dump"
    os.mkdir(debug_dump_path)

    errors = []
    for name, func in [
        ("configuration", orchest_config_dump),
        ("containers version", containers_version_dump),
        ("containers logs", containers_logs_dump),
        ("running containers", running_containers_dump),
        ("health check", health_check_dump),
        ("database", database_debug_dump),
        ("celery", celery_debug_dump),
        ("webserver", websever_debug_dump),
    ]:
        try:
            utils.echo(f"Generating debug data: {name}.")
            func(debug_dump_path)
        except Exception as e:
            utils.echo(f"\tError during generation of debug data: {name}.")
            errors.append((name, e))

    with open(os.path.join(debug_dump_path, "errors.txt"), "w") as file:
        file.write("This is a log of errors that happened during the dump, if any.\n")
        for name, exc in errors:
            file.write(f"{name}: {exc}\n")

    output_path = "/orchest-host/debug-dump"
    if compress:
        os.system(f"tar -zcf {debug_dump_path}.tar.gz -C {debug_dump_path} .")
        debug_dump_path = f"{debug_dump_path}.tar.gz"
        output_path = f"{output_path}.tar.gz"
        os.system(f"cp {debug_dump_path} {output_path}")
    else:
        os.system(f"cp -r {debug_dump_path} /orchest-host/")
