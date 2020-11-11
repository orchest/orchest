Passing data between pipeline steps
===================================

To pass data between the different pipeline steps, across different languages, we make use of the
`Apache Arrow <https://github.com/apache/arrow>`_ project. The :ref:`Orchest SDK` provides a
convenience wrapper of the project to be used within Orchest.

See the :ref:`data passing quickstart<sdk-quickstart-data-passing>` of the SDK to get started
directly.

.. TODO(yannick)
   see the note in data passing at SDK quickstart. We need to tell how the Connections are
   handled and the order in which data is received.
