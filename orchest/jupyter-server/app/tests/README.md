# Tests
To run tests run `python -m pytest` inside `/app/` where also the `tests/` directory can be found.


## Requirements
* IPs and PORTS used by the application have to be available.

Explanation: Due to all the hardcoded paths (and urls), the tests will not run if the specified IPs
and PORTs are already in use by another application (this is because the tests are run on the local
machine and not inside a docker container similar to the production environment).


## Difficulties for writing the tests
D: Subprocess cleanup. Since a POST would only start the server in a subprocess, but never shuts it
down.

A: We could combine the POST wit a DELETE. Just not test them separately and have the DELETE shut
down the subprocess.
