R
=

The Orchest SDK in **R** works through the `reticulate
<https://rstudio.github.io/reticulate/>`_ package. An example project is
provided `here <https://github.com/orchest-examples/orchest-pipeline-r-python-mix>`_.

Using ``reticulate`` to interface the Orchest Python SDK
--------------------------------------------------------
First, create an Orchest environment which uses the ``orchest/base-kernel-r`` base image (you can
find more details :ref:`here <environments>`). Next you want to install ``reticulate`` and configure
access to Python and the Orchest SDK.  You can do so by having a script (let's say ``Install.r``) in
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
access the Orchest SDK through R **in every step that makes use of this environment** . To do data
passing, for example, you would do the following:

.. code-block:: r

 library(reticulate);
 python_path <- system("which python", intern=TRUE);
 use_python(python_path);
 orchest <- import("orchest");
 orchest$output(2, name="Test");

In a child step you will be able to retrieve the output:

.. code-block:: r

 library(reticulate);
 python_path <- system("which python", intern=TRUE);
 use_python(python_path);
 orchest <- import("orchest")
 step_inputs = orchest$get_inputs()
 step_inputs$Test
