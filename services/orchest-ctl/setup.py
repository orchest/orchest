import setuptools

setuptools.setup(
    name="orchest-cli",
    version="0.1.0",
    packages=setuptools.find_packages(),
    install_requires=["typer", "docker", "aiodocker",],
    entry_points="""
        [console_scripts]
        orchest=app.main:__entrypoint
    """,
)
