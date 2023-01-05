(git_config_ssh_keys)=

# Git config and SSH keys

```{eval-rst}
.. meta::
   :description: This page contains information about how to configure git and ssh keys in Orchest.
```

In order to more seamlessly interact with repositories both private and
public, Orchest allows each user to setup a git configuration (user
name, email) and a number of private SSH keys. These will be injected in
the context of git imports and interactive sessions ( `jupyter server`
and `environment shells` ) automatically when said user imports a git
repository or starts an interactive session. Interactive sessions or git
imports initiated by other users will not have those credentials
injected.

```{tip}
   There are numerous guides about creating SSH key pairs online, for example on
   [github](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent). In pretty much all cases,
   you will have to setup the *private* key in Orchest and the *public key* in the server
   or service where the repository resides. Moreover, the key must be created
   **without password**.
```

## Setting up a git configuration and ssh keys

You can set up the git configurations and ssh keys for your user through _Settings_ > _Git & SSH_.
In this view, fill your username and email that you would like to use to commit the changes. To add
SSH keys, click _Add SSH Key_ to open the dialog, fill in the ssh key and the nickname of this key.
Note that a meaningful nickname is preferred because, for security reasons, the submitted ssh keys will not be shown in the UI again. In case of any security instances, you could always delete the key and create a new one.

```{figure} ../img/add-ssh-key.png
:align: center
:width: 600
:alt: Add a new ssh key for your user
```

After setting up the git configuration for your user, you can verify that it works by
starting an interactive session and creating a jupyter terminal. This will lead to
an environment shell where you can run `git config user.name` and `git config user.email`.

After setting up a private SSH key you can test it by either importing a private repository
through Orchest or by starting an interactive session, creating a jupyter terminal and
attempting actions which would require authentication with the SSH key, like cloning a private
repository of yours. Another alternative is to try to use the JupyterLab git import
extensions that comes installed by default in the GUI.

```{warning}
Orchest does not namespace projects, resources or anything else by user. This means that
all users that can log in into the Orchest instance will have access to, for example,
all projects and interactive sessions, which implies access to secrets, SSH keys included,
for example by getting to an interactive session started by another user.
```

(deprecated-repositories)=

## Deprecated repositories imported with the HTTPS protocol.

Existing projects which have been imported (cloned) with the `https` protocol can still
benefit of private SSH keys by changing their origin. This can be achieved by starting
an interactive session and getting into a jupyter terminal, then using `git` to change
the origin, for example `git remote set-url origin git@github.com:orchest/quickstart.git`.
