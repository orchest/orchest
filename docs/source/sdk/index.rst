.. _orchest sdk:

Orchest SDK
===========

SDK for interacting with Orchest. What you can do using the SDK:

* Pass data between pipeline steps. The SDK manages the target and source of the data, leaving the
  user only with the decision what data to pass. The target and source of the data are inferred
  through the defined pipeline definition in Orchest (the ``.orchest/pipeline.json`` file you
  can find in the directory for every pipeline).
* Interact with data sources, such as your regular MySQL databases but also Amazon S3 buckets.
* Use and update the parametrized values of pipeline steps inside your scripts.

.. note::
   The Orchest SDK comes pre-installed when using it in Orchest.

.. toctree::
   :maxdepth: 2
   :caption: Contents:

   python
   development
