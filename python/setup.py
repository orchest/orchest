import setuptools

# The long_description field is used by PyPI when you publish a package,
# to build its project page.
with open("README.md", "r") as f:
    long_description = f.read()

setuptools.setup(
    name="orchest",
    version="0.1.0",
    author="Rick Lamers",
    author_email="rick@orchest.io",
    description="SDK for data passing in Orchest",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/ricklamers/orchest-pypi",
    # py_modules=["orchest"],
    packages=setuptools.find_packages(),
    classifiers=[
        "Development Status :: 1 - Planning",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
    ],
    license='',
)
