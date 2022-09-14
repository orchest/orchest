(settings)=

# Settings

```{eval-rst}
.. meta::
   :description: This page contains information about how configure Orchest through settings.
```

Orchest is configured through _Settings_. Some settings require Orchest to be restarted for changes to take effect. For example:

```json
{
  "AUTH_ENABLED": false,
  "MAX_BUILDS_PARALLELISM": 1,
  "MAX_INTERACTIVE_RUNS_PARALLELISM": 4,
  "MAX_JOB_RUNS_PARALLELISM": 4,
  "TELEMETRY_DISABLED": false,
  "TELEMETRY_UUID": "69b40767-e315-4953-8a2b-355833e344b8"
}
```

`AUTH_ENABLED`

: Boolean: `true` or `false`.

Enables authentication. When enabled, Orchest will require a login. Create user accounts through _settings_ > _manage users_. Orchest does not yet support individual user sessions, meaning that there is no granularity or security between users.

`MAX_BUILDS_PARALLELISM`

: Integer between: `[1, 25]`.

Controls the total number of {term}`Environment` and JupyterLab image builds that can be run in parallel.

```{note}
Do not set an arbitrarily high value as every worker comes with a certain memory overhead,
even when sitting idle.
```

`MAX_INTERACTIVE_RUNS_PARALLELISM`

: Integer between: `[1, 25]`.

Controls the number of {term}`interactive runs <interactive (pipeline) run>` that can be run in
parallel for different Pipelines at a given time. For example, if this is set to `2`, then
only `2` different Pipelines can have interactive runs at the same time. This is useful when
multiple users are using Orchest.

```{note}
Do not set an arbitrarily high value as every worker comes with a certain memory overhead,
even when sitting idle.
```

`MAX_JOB_RUNS_PARALLELISM`

: Integer between: `[1, 25]`.

Controls the number of Job runs that can be run in parallel across all Jobs. For example, if
this is set to 3, then only 3 Pipeline runs can run in parallel.

```{note}
Do not set an arbitrarily high value as every worker comes with a certain memory overhead,
even when sitting idle.
```

`TELEMETRY_DISABLED`

: Boolean: `true` or `false`.

Disables telemetry.

`TELEMETRY_UUID`

: UUID to track usage across user sessions.

```{note}
💡 We do not use any third-party to track telemetry, see what telemetry we track and how in [our codebase].
All telemetry is anonymized through the `TELEMETRY_UUID`. We do not store any IP
information on our servers.
```

[our codebase]: https://github.com/orchest/orchest/blob/4dc2b4fb6a4766de7ff4cb7d3096a56b0a5c5f6c/lib/python/orchest-internals/_orchest/internals/analytics.py#L42-L136

(configuration-jupyterlab)=

## Configuring JupyterLab in Orchest

### Extensions

You can install JupyterLab extensions through the JupyterLab UI and these extensions will persist (across {term}`interactive sessions <interactive session>`) automatically.

JupyterLab also supports server extensions. To install, navigate to _Settings_ > _Configure JupyterLab_. For example:

```bash
pip install jupyterlab-git
```

You can also install extensions from {code}`npm` through the {code}`jupyter` command.

```bash
jupyter labextension install jupyterlab-spreadsheet
```

```{note}
💡 Building the JupyterLab image will stop all interactive sessions since they are still using the old JupyterLab image.
```

### User settings

User settings that are configured through the JupyterLab GUI, such as your _JupyterLab Theme_ or _Text Editor Key Map_, are persisted automatically. No additional configuration needed.
