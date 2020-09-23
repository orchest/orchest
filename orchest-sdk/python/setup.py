import setuptools

# The long_description field is used by PyPI when you publish a package,
# to build its project page.
with open('README.md', 'r') as f:
    long_description = f.read()

setuptools.setup(
    name='orchest',
    version='0.1.0',
    packages=setuptools.find_packages(),
    install_requires=[
        'pyarrow>=0.17.1',
        'boto3>=1.13.26',
        'requests>=2.23.0',
        'SQLAlchemy>=1.3.18',
        'mysqlclient>=2.0.1',
        'psycopg2-binary>=2.8.6',
        'sqlalchemy-redshift>=0.8.1',
    ],

    # Metadata to display on PyPI.
    author='Rick Lamers',
    author_email='rick@orchest.io',
    description='SDK for data passing in Orchest',
    keywords='',
    long_description=long_description,
    long_description_content_type='text/markdown',
    url='https://github.com/ricklamers/orchest-pypi',
    # py_modules=['orchest'],
    project_urls={
        'Documentation': 'https://orchest-sdk.readthedocs.io/en/latest/',
        'Source Code': 'https://github.com/orchest/orchest/tree/master/orchest-sdk',
    },
    classifiers=[
        'Development Status :: 1 - Planning',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.6',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
    ],
    license='',
)
