from setuptools import setup

with open("README.md", "r") as fh:
    long_description = fh.read()

setup(
    name="orchest",
    version="0.0.2",
    description="SDK for interacting with Orchest",
    py_modules=["orchest"],
    package_dir={'': 'src'},
    setup_requires=['wheel'],
    classifiers=[
        "Development Status :: 1 - Planning",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
    ],
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/ricklamers/orchest-pypi",
    author="Rick Lamers",
    author_email="rick@orchest.io",
)
