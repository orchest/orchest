# Orchest SDK
[Docs](https://orchest-sdk.readthedocs.io/en/stable/)
— [Gitter](https://gitter.im/orchest)

Orchest SDK for data passing between pipeline steps in the 
[Orchest platform](https://github.com/orchest/orchest). The SDK manages the destination and source
of the data, leaving the user only with the decision what data to send (because receiving
automatically retrieves all the sent data).

The destination and source of the data are inferred through the defined pipeline definition in the
platform (the `pipeline.json` file).


## Roadmap
* Transfer methods other than over disk, such as through memory (probably powered by 
  [Apache Arrow](https://github.com/apache/arrow)).
* Support for other popular programming languages in the data science stack, such as R.
