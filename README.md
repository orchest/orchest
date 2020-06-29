# Orchest SDK
[Docs](https://orchest-sdk.readthedocs.io/en/latest/)
— [Gitter](https://gitter.im/orchest)

Orchest SDK for data passing between pipeline steps in the 
[Orchest platform](https://github.com/orchest/orchest). The SDK manages the target and source
of the data, leaving the user only with the decision what data to pass.

The target and source of the data are inferred through the defined pipeline definition in the
Orchest platform (the `pipeline.json` file).


## Roadmap
- [X] Transfer methods other than over disk, such as through memory (probably powered by 
  [Apache Arrow](https://github.com/apache/arrow)).
- [ ] Support for other popular programming languages in the data science stack, such as R.
