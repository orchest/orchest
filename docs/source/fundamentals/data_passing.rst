.. _data passing:

Data passing
============

.. meta::
   :description: This page contains information about how data passing works in Orchest, and how to pass data between steps in Orchest.

In Orchest you can pass data between pipeline steps across all the supported languages using the :ref:`Orchest SDK`.
The SDK wraps `Apache Arrow <https://arrow.apache.org/>`_ so that you don't have to worry about the internals.

See the full :ref:`data passing API reference <api transfer>` for more information.

Data passing in Python
----------------------

In this section you will see to pass data between different pipeline steps in Orchest using Python.
The data can be either named or unnamed, as seen below.

Using the following pipeline:

.. figure:: ../img/pipeline.png
   :width: 400
   :alt: Orchest Pipeline defined as three Steps, where both step 1 and 2 send output to step 3
   :align: center

Create and name data in steps 1 and 2, and pass it to step 3 using the Orchest SDK:

.. code-block:: python

   """step-1"""
   import orchest

   data = "Hello, World!"

   # Output the data so that step-3 can retrieve it.
   orchest.output(data, name="my_string")

.. code-block:: python

   """step-2"""
   import orchest

   data = [3, 1, 4]

   # Output the data so that step-3 can retrieve it.
   orchest.output(data, name="my_list")

The output data from steps 1 and 2 is copied to disk so that step 3 can access it.
This also lets you access the data in JupyterLab.

.. code-block:: python

   """step-3"""
   import orchest

   # Get the input for step-3, i.e. the output of step-1 and step-2.
   input_data = orchest.get_inputs()

.. warning::
   🚨 Only call :meth:`orchest.transfer.get_inputs` and :meth:`orchest.transfer.output` once.
   Otherwise your code will break in :ref:`jobs <jobs>` and overwrite data.

Step 3's ``input_data`` will be:

.. code-block:: json

   {
    "my_list": [3, 1, 4],
    "my_string": "Hello, World!",
    "unnamed": []
   }

To know more about the ``unnamed``, key, read on.

Data passing without a name
~~~~~~~~~~~~~~~~~~~~~~~~~~~

It is more explicit to pass data with a name. However, sometimes you may want to use a list
rather than a dictionary to store your data. In these cases it's not necessary to give output data a name.

When passing unnamed data, the receiving step treats the values as an ordered collection (see
:ref:`order of unnamed data <unnamed order>`). In the previous example, step 3 receives input data
with a special key called ``unnamed``.

If you change the output of step 1 to:

.. code-block:: python

   """step-1"""
   import orchest

   data = "Hello, World!"

   # Output the data so that step-3 can retrieve it.
   # But this time, don't give a name.
   orchest.output(data, name=None)

The ``input_data`` in step 3 would then be equal to:

.. code-block:: json

   {
    "my_list": [3, 1, 4],
    "unnamed": ["Hello, World!"]
   }

If you change the step 2 to:

.. code-block:: python

   """step-2"""
   import orchest

   data = [3, 1, 4]

   orchest.output(data, name=None)

The ``input_data`` in step 3 would be:

.. code-block:: json

   {
    "unnamed": ["Hello, World!", [3, 1, 4]]
   }

populating the ``unnamed`` key with the all outputted values without a name.

.. _unnamed order:

Ordering unnamed data
~~~~~~~~~~~~~~~~~~~~~

The visual pipeline editor can define the order of the step connections
and save that order to the pipeline definition file,
which is then used by :meth:`orchest.transfer.get_inputs`.

For example, this is how the data connections look like for step 3 of the example above.
You can reorder the list with drag and drop.

.. image:: ../img/step-connections.png
  :width: 400
  :align: center
  :alt: Ordering data connections in the visual pipeline editor in Orchest

Having the above order of connections, step 3's ``input_data`` becomes:

.. code-block:: json

   {
    "unnamed": [[3, 1, 4], "Hello, World!"]
   }

Top-to-bottom in the visual editor corresponds to left-to-right in ``unnamed``.

.. _r:

Data passing in R
-----------------

.. tip::
   👉 Import this `example project <https://github.com/orchest-examples/orchest-pipeline-r-python-mix>`_
   showcasing **R** straight in Orchest (:ref:`how to import a project <how-to-import-a-project>`).

The Orchest SDK works in **R** through the `reticulate <https://rstudio.github.io/reticulate/>`_ package.
To use it, first create an Orchest environment which uses the ``orchest/base-kernel-r`` base image
(you can find more details :ref:`here <environments>`). Next you need to install ``reticulate`` and configure
access to Python and the Orchest SDK. You can do so by having a script (let's say ``Install.r``) in
your project with the following content:

.. code-block:: r

   install.packages("reticulate", repos = "http://cran.us.r-project.org")
   library(reticulate)

   # Dynamically find system Python
   python_path <- system("which python", intern=TRUE)
   use_python(python_path)

   # Pre compile orchest deps
   orchest <- import("orchest")

   print(orchest)

and having the environment set-up script perform ``Rscript Install.r``.  You will then be able to
access the Orchest SDK through R *in every step that makes use of this environment* as follows:

.. code-block:: r

   library(reticulate);
   python_path <- system("which python", intern=TRUE);
   use_python(python_path);
   orchest <- import("orchest");
   orchest$transfer$output(2, name="Test");

In a child step you will be able to retrieve the output:

.. code-block:: r

   library(reticulate);
   python_path <- system("which python", intern=TRUE);
   use_python(python_path);
   orchest <- import("orchest")
   step_inputs = orchest$transfer$get_inputs()
   step_inputs$Test

Data passing in Julia
---------------------

Refer to the `Julia example project <https://github.com/orchest-examples/julia-orchest-sdk>`_
showcasing **Julia** in Orchest (:ref:`how to import a project <how-to-import-a-project>`).

Data passing in JavaScript
--------------------------

Refer to the `JavaScript example project <https://github.com/orchest-examples/javascript-orchest-sdk>`_
showcasing **JavaScript** in Orchest (:ref:`how to import a project <how-to-import-a-project>`).
