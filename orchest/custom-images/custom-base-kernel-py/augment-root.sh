apt-get update
apt-get install default-libmysqlclient-dev -y

# install orchest-sdk and its dependencies
pip install git+https://github.com/orchest/orchest.git@$1#subdirectory=orchest-sdk/python mysqlclient psycopg2-binary sqlalchemy-redshift boto3