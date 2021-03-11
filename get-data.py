import orchest
import pandas as pd
from sklearn import datasets

# Explicitly cache the data in the "/data" directory since the
# kernel is running in a Docker container, which are stateless.
# The "/data" directory is a special directory managed by Orchest
# to allow data to be persisted and shared across pipelines and
# even projects.
print("Dowloading California housing data...")
data = datasets.fetch_california_housing(data_home="/data")

# Convert the data into a DataFrame.
df_data = pd.DataFrame(data["data"], columns=data["feature_names"])
df_target = pd.DataFrame(data["target"], columns=["MedHouseVal"])

# Output the housing data so the next steps can retrieve it.
print("Outputting converted housing data...")
orchest.output((df_data, df_target), name="data")
print("Success!")