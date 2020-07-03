# pip install torch torchvision tensorflow

# install orchest-sdk
# The input will be the name of the branch of the orchest-sdk to install.
pip install git+https://github.com/orchest/orchest-sdk.git@$1#subdirectory=python

# install mysqlclient dependencies
pip install mysqlclient

# install postgres dependencies
pip install psycopg2-binary

# install redshift dependencies
pip install sqlalchemy-redshift

# install aws s3
pip install boto3
