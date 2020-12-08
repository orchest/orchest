import multiprocessing

from _orchest.internals import config as _config

accesslog = _config.WEBSERVER_LOGS

workers = 1
bind = "0.0.0.0:80"
keepalive = 30
