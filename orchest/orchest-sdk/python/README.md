# Orchest SDK

This is the Python package that will enable Python integration with the Orchest platform for machine learning.


## Installation

For now installation is done simply by calling `pip install orchest`.


## Usage

To send data to the next step in your pipeline you can use the following API:

```python
from orchest import data

data.send([1, 2, 3])
```
