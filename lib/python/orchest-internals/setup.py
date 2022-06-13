import setuptools

setuptools.setup(
    name="orchest-internals",
    version="0.2.0",
    packages=setuptools.find_namespace_packages(include=["_orchest.*"]),
    # Metadata to display on PyPI.
    description="Internally used library for services within Orchest",
    keywords="",
    classifiers=[
        "Development Status :: 1 - Planning",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
    ],
    license="",
    install_requires=["requests>=2.0.0", "Flask>=1.0.0", "posthog==1.4.7"],
)
