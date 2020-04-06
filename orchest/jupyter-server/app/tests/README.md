# Tests

The following modules have unittests
* `core.start_server`

The following do not yet have tests
* `core.api.namespace_server`

To test the Flask API a useful link might be: https://flask.palletsprojects.com/en/1.1.x/testing/
- In particular the fixture to create a test client.


## Difficulties for writing the tests
(D: Difficulty, A: Answer)
D: The application will have to be tested as a whole. Since the API and Jupyter server are connected
thoroughly it is not possible to write unittests without mocking away all the logic. However, this
defeats the purpose of testing in the first place.

A: What can be done is pointing away from the `tmp` directory to a test directory to store the server
information. 

D: Subprocess cleanup. Since a POST would only start the server in a subprocess, but never shut it
down.

A: We could combine the POST wit a DELETE. Just not test them separately and have the DELETE shut
down the subprocess.


## Conclusion for now
Skip the tests for the `apis.namespace_server` because this has difficulties with the subprocess
that is being started to call the Jupyter server. Instead write elaborate logging to obtain
information on failures. If many problems arise in this area of the code (the area where the Jupyter
server should be started), then we can always add the tests later. 

For now, writing these tests will take up too much time.

(Keep in mind the `:ALEInfo` obtion in Vim with the ALE plugin. This helped them tremendously!)
