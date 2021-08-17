R
=

Orchest currently does not support a native **R** SDK. You can make use of the
`reticulate <https://rstudio.github.io/reticulate/>`_ package to interface the python SDK. An example project is
provided `here <https://github.com/orchest-examples/orchest-pipeline-r-python-mix>`_.

Using Reticulate to interface the Orchest python SDK
----------------------------------------------------
First, create an Orchest environment which uses the
**orchest/base-kernel-r** base image, through said environment you can
install **reticulate** and configure access to **python** and the **Orchest
SDK**.  
You can do so by having a script (let's say **Install.r**) in your project
with the following content::

   install.packages("reticulate", repos = "http://cran.us.r-project.org")
   library(reticulate)

   # Dynamically find system Python
   python_path <- system("which python", intern=TRUE)
   use_python(python_path)

   # Pre compile orchest deps
   orchest <- import("orchest")

   print(orchest)

And having the environment set-up script perform ``Rscript Install.r``.
You will then be able to access the Orchest SDK through R **in every step
that makes use of this environment** . To do data passing, for example, you
would do the following::

 library(reticulate);
 python_path <- system("which python", intern=TRUE);
 use_python(python_path);
 orchest <- import("orchest");
 orchest$output(2, name="Test");

In a child step you will be able to retrieve the output::

 library(reticulate);
 python_path <- system("which python", intern=TRUE);
 use_python(python_path);
 orchest <- import("orchest")
 step_inputs = orchest$get_inputs()
 step_inputs$Test



