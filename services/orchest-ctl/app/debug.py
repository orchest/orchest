import json
import logging
import os
from functools import reduce
from typing import List, Set

from docker.errors import NotFound

from _orchest.internals import config as _config
from app import utils
from app.config import _on_start_images
from app.docker_wrapper import OrchestResourceManager

health_check_command = {
    "orchest/orchest-api:latest": "wget localhost/api -T 2 -t 2 --spider",
    "orchest/orchest-webserver:latest": "wget localhost -T 2 -t 2 --spider",
    "orchest/auth-server:latest": "wget localhost/login -T 2 -t 2 --spider",
    "orchest/celery-worker:latest": "celery inspect ping -A app.core.tasks",
    "orchest/file-manager:latest": "wget localhost -T 2 -t 2 --spider",
    "postgres:13.1": "pg_isready --username postgres",
    "rabbitmq:3": (
        'su rabbitmq -c "/opt/rabbitmq/sbin/rabbitmq-diagnostics '
        '-q check_port_connectivity"'
    ),
}

logger = logging.getLogger(__name__)


def health_check(resource_manager: OrchestResourceManager) -> None:
    """

    Returns:
        Dict mapping container names to health check exit codes.
    """
    (
        running_containers_ids,
        running_containers_names,
    ) = resource_manager.get_containers(state="running")

    check_names = []
    cmds = []

    # Run health checks for containers that do have one.
    for id, container in zip(running_containers_ids, running_containers_names):
        hcheck = health_check_command.get(container)
        if hcheck is not None:
            cmds.append([id, hcheck])
            check_names.append(container)

    exit_codes = resource_manager.docker_client.exec_runs(cmds)
    container_to_code = {}
    for container, code in zip(check_names, exit_codes):
        container_to_code[container] = code

    return container_to_code


def database_debug_dump(
    resource_manager: OrchestResourceManager,
    path: str,
    dbs: List[str] = ["auth_server", "orchest_api", "orchest_webserver"],
) -> None:
    """Get database schema, revision version, rows per table(s)."""

    docker_wrapper = resource_manager.docker_client

    try:
        container = docker_wrapper.get_container("orchest-database")
        container_id = container.id

        if container.status != "running":
            logging.warning("\tThe orchest-database is not running.")
            return

    except NotFound:
        logging.warning("\tThe orchest-database is not running.")
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


def celery_debug_dump(
    resource_manager: OrchestResourceManager, path: str, ext: bool = False
) -> None:
    """Worker logs and output of celery inspect commands."""

    docker_wrapper = resource_manager.docker_client

    try:
        container = docker_wrapper.get_container("celery-worker")
        if container.status != "running":
            logging.warning(
                (
                    "\tThe celery-worker container is not running, the debug "
                    "data will be incomplete."
                )
            )
    except NotFound:
        logging.warning(
            (
                "\tCould not find the celery-worker container. "
                "That means that it is not running nor stopped."
            )
        )
        return

    container = docker_wrapper.get_container("celery-worker")
    cel_debug_dump_directory = os.path.join(path, "celery")

    if not os.path.exists(cel_debug_dump_directory):
        os.mkdir(cel_debug_dump_directory)

    files_to_copy = []

    if container.status == "running":

        inspect_commands = [
            "active_queues",
            "conf",
            "revoked",
            "report",
            "stats",
        ]

        if ext:
            inspect_commands.extend(
                [
                    "active",
                    "reserved",
                    "scheduled",
                ]
            )

        cmd_template = "celery inspect -A app.core.tasks {name} > {name}.txt"
        cmds = []
        # Run inspection commands and get the result.
        for inspect_command in inspect_commands:
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

    if ext:
        # Add log files to the files to copy.
        for worker in [
            "celery_builds",
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


def webserver_debug_dump(resource_manager: OrchestResourceManager, path: str) -> None:
    """Get the webserver log file."""

    docker_wrapper = resource_manager.docker_client
    try:
        container_id = docker_wrapper.get_container("orchest-webserver").id
    except NotFound:
        logging.warning(
            (
                "\tCould not find the orchest-webserver container. "
                "That means that it is not running nor stopped."
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


def containers_logs_dump(
    resource_manager: OrchestResourceManager, path: str, ext=False
) -> None:
    """Get the logs of every Orchest container, except steps."""

    containers_logs = os.path.join(path, "containers-logs")
    if not os.path.exists(containers_logs):
        os.mkdir(containers_logs)

    docker_wrapper = resource_manager.docker_client
    ids, names = docker_wrapper.get_containers(
        state="all", network=_config.DOCKER_NETWORK
    )

    orchest_set: Set[str] = reduce(lambda x, y: x.union(y), _on_start_images, set())
    session_containers = {
        "orchest/jupyter-server:latest",
        "orchest/jupyter-enterprise-gateway",
        "orchest/memory-server:latest",
        "orchest/session-sidecar:latest",
    }

    # Only log these containers if in ext mode, since they coud log user
    # data in case of error, even when running with --no-dev.
    ext_names = {"postgres:13.1"}

    for id, name in zip(ids, names):

        if not ext and name in ext_names:
            continue

        if name in orchest_set:
            file_name = f"{name}.txt"
        elif name in session_containers:
            file_name = f"{name}-{id}.txt"
        # Do not pickup containers that are running user pipeline steps
        # , to avoid the risk of getting user data through its logs.
        else:
            continue

        # Else orchest/<something> won't work as a file name in
        # os.path.join.
        file_name = file_name.replace("orchest/", "")
        container = docker_wrapper.get_container(id)
        logs = container.logs()

        with open(os.path.join(containers_logs, file_name), "wb") as file:
            file.write(logs)


def containers_version_dump(
    resource_manager: OrchestResourceManager, path: str
) -> None:
    """Get the version of Orchest containers"""

    with open(os.path.join(path, "containers_version.txt"), "w") as file:
        for name, version in resource_manager.containers_version().items():
            file.write(f"{name:<44}: {version}\n")


def orchest_config_dump(path: str) -> None:
    """Get the Orchest config file, with telemetry UUID removed"""

    # Copy the config
    with open("/config/config.json") as input_json_file:
        config = json.load(input_json_file)
        # Removed for privacy.
        del config["TELEMETRY_UUID"]

        with open(os.path.join(path, "config.json"), "w") as output_json_file:
            json.dump(config, output_json_file)


def health_check_dump(resource_manager: OrchestResourceManager, path: str) -> None:
    with open(os.path.join(path, "health_check.txt"), "w") as file:
        json.dump(health_check(resource_manager), file, indent=4)


def running_containers_dump(
    resource_manager: OrchestResourceManager, path: str
) -> None:
    """Get which Orchest containers are running"""

    _, running_containers_names = resource_manager.get_containers(state="running")
    with open(os.path.join(path, "running_containers.txt"), "w") as file:
        for name in running_containers_names:
            file.write(f"{name}\n")


def debug_dump(ext: bool, compress: bool) -> None:

    debug_dump_path = "/tmp/debug-dump"
    os.mkdir(debug_dump_path)

    rmanager = OrchestResourceManager()
    errors = []
    for name, func, args in [
        ("configuration", orchest_config_dump, (debug_dump_path,)),
        (
            "containers version",
            containers_version_dump,
            (
                rmanager,
                debug_dump_path,
            ),
        ),
        ("containers logs", containers_logs_dump, (rmanager, debug_dump_path, ext)),
        (
            "running containers",
            running_containers_dump,
            (
                rmanager,
                debug_dump_path,
            ),
        ),
        (
            "health check",
            health_check_dump,
            (
                rmanager,
                debug_dump_path,
            ),
        ),
        (
            "database",
            database_debug_dump,
            (
                rmanager,
                debug_dump_path,
            ),
        ),
        ("celery", celery_debug_dump, (rmanager, debug_dump_path, ext)),
        (
            "webserver",
            webserver_debug_dump,
            (
                rmanager,
                debug_dump_path,
            ),
        ),
    ]:
        try:
            utils.echo(f"Generating debug data: {name}.")
            func(*args)
        except Exception as e:
            utils.echo(f"\tError during generation of debug data: {name}.")
            errors.append((name, e))

    with open(os.path.join(debug_dump_path, "errors.txt"), "w") as file:
        file.write("This is a log of errors that happened during the dump, if any.\n")
        for name, exc in errors:
            file.write(f"{name}: {exc}\n")

    if compress:
        os.system(f"tar -zcf {debug_dump_path}.tar.gz -C {debug_dump_path} .")
        debug_dump_path = f"{debug_dump_path}.tar.gz"

        # relative to orchest repo directory
        host_path = "debug-dump.tar.gz"
        os.system(f"cp {debug_dump_path} /orchest-host/{host_path}")

    else:
        # This is to account for the behaviour of cp when it comes to
        # already exising directory. Otherwise, if "t" already exists,
        # the data we want to copy will become a subdirectory of "t",
        # instead of overwriting its files.
        host_path = "debug-dump/"
        t = "/orchest-host/" + host_path
        os.system(f"mkdir -p {t} && cp -r {debug_dump_path}/* {t}")

    utils.echo(f"Complete! Wrote debug dump to: ./{host_path}")
