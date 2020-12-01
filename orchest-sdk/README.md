# Orchest SDK

[Docs](https://orchest.readthedocs.io/en/stable/user_guide/sdk/index.html)

Orchest SDK for interacting with [Orchest](https://github.com/orchest/orchest). What you can do
using the SDK:

- Data passing between pipeline steps. It manages the target and source of the data, leaving the
  user only with the decision what data to pass. The target and source of the data are inferred
  through the defined pipeline definition in Orchest (the `pipeline.json` file).
- Interacting with data sources, such as your regular MySQL databases but also Amazon S3 buckets.
- Using the parametrized values of pipeline steps and updating them.
