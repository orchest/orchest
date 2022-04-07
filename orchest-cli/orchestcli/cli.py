import click

CONTEXT_SETTINGS = {
    "help_option_names": ["-h", "--help"],
}


@click.group(context_settings=CONTEXT_SETTINGS)
def cli():
    """The Orchest CLI to manage your Orchest Cluster on Kubernetes."""
    pass


@cli.command()
def install():
    """Example script."""
    click.echo("Hello World!")
