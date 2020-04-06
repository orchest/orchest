# jupyter-server 
Explanation of project structure

```bash
.
├── app
│   ├── apis
│   │   ├── __init__.py
│   │   └── namespace_servers.py
│   ├── core
│   │   ├── __init__.py
│   │   └── start_server.py
│   ├── __init__.py
│   └── tmp
├── config.py
├── main.py
├── README.md
├── requirements.txt
└── tests
    ├── README.md
    ├── test_apis_namespace_server.py
    └── test_core_start_server.py
```

jupyter-server: name of this sub project. You should also create you venv here.

app/: all the files are put inside this directory because the uswgi-nginx Docker image requires it
to be so. It wants the app/main.py to be there. So to allow for testing everything is put inside
this app/directory (including the tests). TODO: exclude these tests from building the dockerfile


