import docker
import os

def orchest_ctl(client, command):

    return client.containers.run("orchestsoftware/orchest-ctl:latest", command, detach=True,
        mounts=[
            docker.types.Mount(target="/var/run/docker.sock", source="/var/run/docker.sock", type='bind')
        ],
        environment={
            "HOST_CONFIG_DIR": os.environ.get("HOST_CONFIG_DIR"),
            "HOST_REPO_DIR": os.environ.get("HOST_REPO_DIR"),
            "HOST_USER_DIR": os.environ.get("HOST_USER_DIR")
        }
    )