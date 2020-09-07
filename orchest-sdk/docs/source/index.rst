Orchest SDK
===========

`Website <https://www.orchest.io>`_
-- `GitHub <http://www.github.com/orchest/orchest-sdk>`_
-- `Slack <https://join.slack.com/t/orchest/shared_invite/zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w>`_


Orchest SDK for interacting with Orchest. What you can do using the SDK:

* Data passing between pipeline steps. It manages the target and source of the data, leaving the
  user only with the decision what data to pass. The target and source of the data are inferred
  through the defined pipeline definition in Orchest (the `pipeline.json` file).
* Interacting with data sources, such as your regular MySQL databases but also Amazon S3 buckets.
* Using the parametrized values of pipeline steps and updating them.


.. toctree::
   :maxdepth: 2
   :caption: Contents:

   python
   development
