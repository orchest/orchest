import setuptools

setuptools.setup(
    name="orchest-cli",
    version="0.1.0",
    packages=setuptools.find_packages(),
    install_requires=[
        "typer",
        "docker",
        "aiodocker",
        "tqdm==4.53.0",
    ],
    entry_points="""
        [console_scripts]
        orchest=app.main:__entrypoint
    """,
)
