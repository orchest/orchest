import setuptools

setuptools.setup(
    name="orchest-cli",
    version="0.1.0",
    packages=setuptools.find_packages(),
    install_requires=[
        "typer",
        "docker",
        "six>=1.13.0",
        "aiodocker==0.21.0",
        "tqdm==4.53.0",
        "orchest-internals @ file://localhost/orchest/lib/python/orchest-internals",
    ],
    entry_points="""
        [console_scripts]
        orchest=app.cli.main:__entrypoint
    """,
)
