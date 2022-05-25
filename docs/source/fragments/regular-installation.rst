Deploy ``orchest-controller``
-----------------------------

The ``orchest-controller`` is required to install and manage ``orchest``

.. code-block:: bash

   git clone https://github.com/orchest/orchest.git && cd orchest

   # Create the orchest namespace, as the Orchest Controller and Cluster will be deployed in
   # orchest namespace
   kubectl create ns orchest

   # Deploy orchest-controller
   kubectl apply -f services/orchest-controller/deploy-controller

Install ``orchest-cli``
-----------------------

.. code-block:: bash

   # Install orchest-cli via pip
   pip install orchest-cli


Install ``orchest`` via ``orchest-cli``
----------------------------------------

.. code-block:: bash

   # Install orchest
   orchest install
