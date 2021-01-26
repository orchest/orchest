from typing import List, Literal
from unittest.mock import MagicMock

import pytest

from app import orchest, utils


@pytest.mark.parametrize(
    ("installed_images", "expected_stdout", "install_orchest"),
    [
        (["A", "B"], "Installation is already complete.", False),
        (["A"], "Some images have been pulled before.", True),
        ([], "Installing Orchest...", True),
    ],
    ids=["completed", "partial", "none"],
)
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
    ("running_containers", "expected_stdout"),
    [
        (["A", "B"], "Orchest is running."),
        (["A"], "has reached an invalid state"),
        ([], "Orchest is not running."),
    ],
    ids=["running", "partially-running", "not-running"],
)
def test_status(running_containers, expected_stdout, capsys):
    resource_manager = orchest.OrchestResourceManager()
    resource_manager.get_containers = MagicMock(return_value=(None, running_containers))

    app = orchest.OrchestApp()
    app.resource_manager = resource_manager
    app.on_start_images = ["A", "B"]

    app.status()

    captured = capsys.readouterr()
    assert expected_stdout in captured.out

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

    app = orchest.OrchestApp()
    app.docker_client = docker_client
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
        (["A", "B"], 0, None, "Don't forget to restart Orchest"),
        (["A"], 0, None, "Don't forget to restart Orchest"),
        (["A"], 1, None, "Cancelling update..."),
        (["A"], 0, "web", "Update completed."),
    ],
    ids=["vanilla-1", "vanilla-2", "failed-repo-update", "web"],
)
def test_update(installed_images, update_exit_code, mode, expected_stdout, capsys):
    utils.update_git_repo = MagicMock(return_value=update_exit_code)

    resource_manager = orchest.OrchestResourceManager()
    resource_manager.get_images = MagicMock(return_value=installed_images)
    resource_manager.remove_env_build_imgs = MagicMock(return_value=None)

    docker_client = orchest.DockerWrapper()
    docker_client.pull_images = MagicMock(return_value=None)

    app = orchest.OrchestApp()
    app.resource_manager = resource_manager
    app.docker_client = docker_client
    app.restart = MagicMock(return_value=None)

    app.update(mode=mode)

    captured = capsys.readouterr()
    assert expected_stdout in captured.out

    if update_exit_code != 0:
        return

    resource_manager.remove_env_build_imgs.assert_called_once()

    docker_client.pull_images.assert_called_once_with(
        installed_images, prog_bar=True, force=True
    )

    if mode == "web":
        app.restart.assert_called_once()


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
        return_value=(running_containers, running_containers)
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

    resource_manager.get_containers.assert_called_once_with(state="running")
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
def test_start(
    container_config,
    running_containers,
    exited_containers,
    installed_images,
    expected_stdout,
    monkeypatch,
    capsys,
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
        state: Literal["all", "running", "exited"] = "running",
    ):
        if state == "running":
            return running_containers, running_containers
        elif state == "exited":
            return exited_containers, exited_containers

    resource_manager = orchest.OrchestResourceManager()
    resource_manager.get_images = MagicMock(return_value=installed_images)
    monkeypatch.setattr(resource_manager, "get_containers", mocked_get_containers)
    docker_client = orchest.DockerWrapper()
    docker_client.remove_containers = MagicMock(return_value=None)
    docker_client.run_containers = MagicMock(
        return_value={
            "orchest-database": {"id": None},
        }
    )
    docker_client.is_network_installed = MagicMock(return_value=True)
    utils.fix_userdir_permissions = MagicMock(return_value=None)
    utils.wait_for_zero_exitcode = MagicMock(return_value=None)

    app = orchest.OrchestApp()
    app.on_start_images = ["A", "B"]
    app.resource_manager = resource_manager
    app.docker_client = docker_client

    container_config = create_vanilla_container_config(container_config)

    if expected_stdout == "ValueError":
        with pytest.raises(ValueError):
            app.start(container_config)

        return
    else:
        app.start(container_config)

    captured = capsys.readouterr()
    assert expected_stdout in captured.out

    if not running_containers:
        return

    docker_client.run_containers.asset_called_with(
        container_config, use_name=True, detach=True
    )
