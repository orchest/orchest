How to...
=========

.. _cloud installation:

Self-host Orchest
-----------------
Running Orchest on a cloud hosted VM (such as EC2) does not require a special installation. Simply
follow the :ref:`regular installation process <regular installation>`.

To enable SSL you first need to get the SSL certificates for your domain and put the certificates in
the correct place so that Orchest recognizes them. Luckily, this can all be done using:
``scripts/letsencrypt-nginx.sh <domain> <email>``. For the changes to take effect you need to
start Orchest on port ``80`` (as otherwise the default port ``8000`` is used):

.. code-block:: bash

   ./orchest start --port=80

.. tip::
   Refer to the :ref:`authentication section <authentication>` to enable the authentication server,

