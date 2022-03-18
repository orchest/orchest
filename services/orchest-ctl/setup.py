import setuptools

setuptools.setup(
    name="orchest-cli",
    version="0.1.0",
    packages=setuptools.find_packages(),
    install_requires=[
        "kubernetes==21.7.0",
        "six>=1.13.0",
        "tqdm==4.53.0",
        "typer==0.4.0",
        "PyYAML==6.0",
        "orchest-internals @ file://localhost/orchest/lib/python/orchest-internals",
        "requests==2.27.1",
        "validators==0.18.2",
    ],
    entry_points="""
        [console_scripts]
        orchest=app.cli.main:__entrypoint
    """,
)
