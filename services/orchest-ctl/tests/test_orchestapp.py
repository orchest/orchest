from typing import List, Literal
from unittest.mock import MagicMock, patch

import click
import pytest
import typer

from app import config, orchest, spec, utils


@pytest.mark.parametrize(
    ("installed_images", "expected_stdout", "install_orchest"),
    [
        (["A", "B"], "Installation is already complete.", False),
        ([], "Installing Orchest...", True),
    ],
    ids=["completed", "none"],
)
@patch("app.docker_wrapper.OrchestResourceManager.network", "orchest-ctl-tests")
def test_install(installed_images, expected_stdout, install_orchest, capsys):
    required_images = ["A", "B"]
    orchest.get_required_images = MagicMock(return_value=required_images)

    resource_manager = orchest.OrchestResourceManager()
    resource_manager.install_network = MagicMock(return_value=None)
    resource_manager.get_images = MagicMock(return_value=installed_images)

    docker_client = orchest.DockerWrapper()
    docker_client.pull_images = MagicMock(return_value=None)

    app = orchest.OrchestApp()
    app.resource_manager = resource_manager
    app.docker_client = docker_client
    app.version = MagicMock(return_value=None)

    # Install Orchest.
    app.install(language="python", gpu=False)

    captured = capsys.readouterr()
    assert expected_stdout in captured.out

    if not install_orchest:
        return

    resource_manager.install_network.assert_called_once()

    docker_client.pull_images.assert_called_once_with(
        set(required_images) - set(installed_images), prog_bar=True
    )


@pytest.mark.parametrize(
    (
        "running_containers",
        "restarting",
        "updating",
        "expected_stdout",
        "expected_exit_code",
    ),
    [
        (["A", "B"], False, False, "Orchest is running.", 0),
        (["A"], False, False, "has reached an invalid state", 2),
        ([], False, False, "Orchest is not running.", 1),
        ([], True, False, "Orchest is currently restarting.", 4),
        ([], False, True, "Orchest is currently updating.", 5),
    ],
    ids=["running", "partially-running", "not-running", "restartig", "updating"],
)
def test_status(
    running_containers,
    restarting,
    updating,
    expected_stdout,
    expected_exit_code,
    capsys,
    monkeypatch,
):
    resource_manager = orchest.OrchestResourceManager()
    resource_manager.get_containers = MagicMock(return_value=(None, running_containers))

    app = orchest.OrchestApp()
    app.resource_manager = resource_manager
    app._is_restarting = MagicMock(return_value=restarting)
    app._is_updating = MagicMock(return_value=updating)
    monkeypatch.setattr(orchest, "_on_start_images", ["A", "B"])

    exit_code = 0
    try:
        app.status()
    except typer.Exit as exit:
        exit_code = exit.exit_code

    assert exit_code == expected_exit_code
    captured = capsys.readouterr()
    assert expected_stdout in captured.out

    if not restarting and not updating:
        resource_manager.get_containers.assert_called_once_with(state="running")


@pytest.mark.parametrize(
    ("extensive", "exec_stdout", "expected_stdout"),
    [
        (False, None, "Orchest version: v0.1.6"),
        (
            True,
            {"A": {"stdout": ["v0.1.6\n"]}, "B": {"stdout": ["v0.1.6\n"]}},
            "v0.1.6",
        ),
        (
            True,
            {"A": {"stdout": ["v0.1.6\n"]}, "B": {"stdout": ["v0.1.5\n"]}},
            "Not all containers are running on the same version of Orchest",
        ),
    ],
    ids=["regular", "extensive", "unmatching-versions"],
)
def test_version(extensive, exec_stdout, expected_stdout, capsys, monkeypatch):
    if not extensive:
        monkeypatch.setenv("ORCHEST_VERSION", "v0.1.6")

    resource_manager = orchest.OrchestResourceManager()
    resource_manager.get_images = MagicMock(return_value=["A", "B"])

    docker_client = orchest.DockerWrapper()
    docker_client.run_containers = MagicMock(return_value=exec_stdout)
    resource_manager.docker_client = docker_client

    app = orchest.OrchestApp()
    app.resource_manager = resource_manager

    app.version(ext=extensive)

    captured = capsys.readouterr()
    assert expected_stdout in captured.out

    if not extensive:
        return

    resource_manager.get_images.assert_called()
    docker_client.run_containers.assert_called()


@pytest.mark.parametrize(
    ("installed_images", "update_exit_code", "mode", "expected_stdout"),
    [
        (["A", "B"], 0, None, "Update completed. To start Orchest again, run:"),
        (["A"], 0, None, "Update completed. To start Orchest again, run:"),
        (["A"], 1, None, "Cancelling update..."),
        (["A"], 0, "web", "Update completed."),
    ],
    ids=["vanilla-1", "vanilla-2", "failed-repo-update", "web"],
)
def test_update(installed_images, update_exit_code, mode, expected_stdout, capsys):
    utils.update_git_repo = MagicMock(return_value=update_exit_code)
    spec.get_container_config = MagicMock(return_value=None)

    resource_manager = orchest.OrchestResourceManager()
    resource_manager.get_images = MagicMock(return_value=installed_images)
    resource_manager.tag_environment_images_for_removal = MagicMock(return_value=None)
    resource_manager.remove_jupyter_build_imgs = MagicMock(return_value=None)

    docker_client = orchest.DockerWrapper()
    docker_client.pull_images = MagicMock(return_value=None)

    app = orchest.OrchestApp()
    app.resource_manager = resource_manager
    app.docker_client = docker_client
    app.stop = MagicMock(return_value=None)
    app.version = MagicMock(return_value=None)

    if update_exit_code != 0:
        with pytest.raises(click.exceptions.Exit):
            app.update(mode=mode)
    else:
        app.update(mode=mode)

    captured = capsys.readouterr()
    assert expected_stdout in captured.out

    if update_exit_code != 0:
        return

    resource_manager.tag_environment_images_for_removal.assert_called_once()
    resource_manager.remove_jupyter_build_imgs.assert_called_once()

    to_pull_images = set(config.ORCHEST_IMAGES["minimal"]) | set(installed_images)
    docker_client.pull_images.assert_called_once_with(
        to_pull_images, prog_bar=True, force=True
    )


@pytest.mark.parametrize(
    ("running_containers", "skip_containers", "stopped_containers", "expected_stdout"),
    [
        ([], None, None, "Orchest is not running."),
        (["A"], None, ["A"], "Shutdown successful."),
        (["A", "B"], ["B"], ["A"], "Shutdown successful."),
    ],
    ids=["not-running", "running", "skip"],
)
def test_stop(
    running_containers, skip_containers, expected_stdout, stopped_containers, capsys
):
    resource_manager = orchest.OrchestResourceManager()
    resource_manager.get_containers = MagicMock(
        side_effect=[(running_containers, running_containers), ([], [])]
    )
    docker_client = orchest.DockerWrapper()
    docker_client.remove_containers = MagicMock(return_value=None)

    app = orchest.OrchestApp()
    app.resource_manager = resource_manager
    app.docker_client = docker_client

    app.stop(skip_containers=skip_containers)

    captured = capsys.readouterr()
    assert expected_stdout in captured.out

    if not running_containers:
        return

    resource_manager.get_containers.assert_called_with(state="running")
    docker_client.remove_containers.assert_called_once_with(tuple(stopped_containers))


@pytest.mark.parametrize(
    (
        "container_config",
        "running_containers",
        "exited_containers",
        "installed_images",
        "expected_stdout",
    ),
    [
        (None, None, None, ["A"], "make sure Orchest is installed"),
        (["A"], None, None, ["A", "B"], "ValueError"),
        (["A", "B"], ["A", "B"], None, ["A", "B"], "Orchest is already running..."),
        (["A", "B"], ["A"], None, ["A", "B"], "Orchest seems to be partially running."),
        (["A", "B"], [], None, ["A", "B"], "Starting Orchest..."),
    ],
    ids=[
        "not-installed",
        "invalid-config",
        "already-running",
        "partially-running",
        "clean",
    ],
)
@patch("app.docker_wrapper.OrchestResourceManager.network", "orchest-ctl-tests")
def test_start(
    container_config,
    running_containers,
    exited_containers,
    installed_images,
    expected_stdout,
    monkeypatch,
    capsys,
    request,
):
    def create_vanilla_container_config(names: List[str]):
        if names is None:
            return None

        res = {}
        for name in names:
            res[name] = {
                "Image": name,
            }
        return res

    def mocked_get_containers(
        state: Literal["all", "running", "exited"] = "running", full_info: bool = False
    ):
        if state == "running":
            return running_containers, running_containers
        elif state == "exited":
            return exited_containers, exited_containers

    resource_manager = orchest.OrchestResourceManager()
    resource_manager.get_images = MagicMock(return_value=installed_images)
    resource_manager.remove_orchest_dangling_imgs = MagicMock(return_value=None)
    monkeypatch.setattr(resource_manager, "get_containers", mocked_get_containers)
    docker_client = orchest.DockerWrapper()
    docker_client.remove_containers = MagicMock(return_value=None)
    docker_client.run_containers = MagicMock(
        return_value={
            "orchest-database": {"id": None},
            "rabbitmq-server": {"id": None},
        }
    )
    docker_client.is_network_installed = MagicMock(return_value=True)
    utils.fix_userdir_permissions = MagicMock(return_value=None)
    utils.wait_for_zero_exitcode = MagicMock(return_value=None)

    app = orchest.OrchestApp()
    monkeypatch.setattr(orchest, "_on_start_images", [set("A"), set("B")])
    monkeypatch.setattr(orchest, "ORCHEST_IMAGES", {"minimal": ["A", "B"]})
    resource_manager.docker_client = docker_client
    app.resource_manager = resource_manager
    app.docker_client = docker_client

    container_config = create_vanilla_container_config(container_config)

    if request.node.callspec.id == "invalid-config":
        with pytest.raises(ValueError):
            app.start(container_config)
        return
    elif request.node.callspec.id in ["not-installed", "partially-running"]:
        with pytest.raises(click.exceptions.Exit):
            app.start(container_config)
    else:
        app.start(container_config)

    captured = capsys.readouterr()
    assert expected_stdout in captured.out

    if not running_containers:
        return

    docker_client.run_containers.asset_called_with(
        container_config, use_name=True, detach=True
    )
