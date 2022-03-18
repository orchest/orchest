from pathlib import Path

import setuptools

# The long_description field is used by PyPI when you publish a package,
# to build its project page.
long_description = Path("README.md").read_text(encoding="utf-8")
version = Path("orchest/_version.py").read_text(encoding="utf-8")
about = {}
exec(version, about)

setuptools.setup(
    name="orchest",
    version=about["__version__"],
    packages=setuptools.find_packages(),
    install_requires=["pyarrow>=1.0.0,<8.0", "requests>=1.0.0"],
    # Metadata to display on PyPI.
    author="Rick Lamers",
    author_email="rick@orchest.io",
    description="SDK for Orchest",
    keywords="",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/orchest/orchest",
    project_urls={
        "Documentation": (
            "https://docs.orchest.io/en/stable/fundamentals/sdk/index.html"
        ),
        "Source Code": (
            "https://github.com/orchest/orchest/tree/master/orchest-sdk/python"
        ),
    },
    classifiers=[
        "Development Status :: 1 - Planning",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
    ],
    license="Apache 2.0",
)
