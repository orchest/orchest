# Orchest SDK
Python package to pass data between pipeline steps in the Orchest platform.

## Installation
```bash
pip install orchest
```

## Basic usage
Example for sending through disk, where `Step 1` -> `Step 2`.
```python
"""Step 1"""
from orchest import transfer

data = [1, 2, 3]

# Note that you do not need to specify what step you want to send the
# data to. This is managed through your pipeline definition.
transfer.send_to_disk(data)
```
```python
"""Step 2"""
from orchest import transfer

data = transfer.receive_from_disk()
```
