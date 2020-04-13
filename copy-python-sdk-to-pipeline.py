# This bash script can be used to develop the Python SDK
# it copies the sdk files to a pipeline directory to make it possible to install a local Python package like `pip install -e .tmp-orchest-sdk/orchest`

import os


PIPELINE_UUID = "f514b6ab-c590-4900-aa5f-ed0a1f29f95c"

# copy files
os.system("rm -rf orchest/userdir/pipelines/" + PIPELINE_UUID + "/orchest/")
os.system("cp -r orchest/orchest-sdk/python/src/orchest/ orchest/userdir/pipelines/" + PIPELINE_UUID + "/")


