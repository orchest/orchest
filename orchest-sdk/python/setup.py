import setuptools

# The long_description field is used by PyPI when you publish a package,
# to build its project page.
with open("README.md", "r") as f:
    long_description = f.read()

setuptools.setup(
    name="orchest",
    version="0.2.0",
    packages=setuptools.find_packages(),
    install_requires=[
        "pyarrow>=1.0.0,<=4.0.0",
    ],
    # Metadata to display on PyPI.
    author="Rick Lamers",
    author_email="rick@orchest.io",
    description="SDK for data passing in Orchest",
    keywords="",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/ricklamers/orchest-pypi",
    project_urls={
        "Documentation": (
            "https://orchest.readthedocs.io/en/stable/user_guide/sdk/python.html"
        ),
        "Source Code": ("https://github.com/orchest/orchest/tree/master/orchest-sdk"),
    },
    classifiers=[
        "Development Status :: 1 - Planning",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
    ],
    license="",
)
