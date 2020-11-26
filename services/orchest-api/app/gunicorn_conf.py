import multiprocessing

from _orchest.internals import config as _config

accesslog = "-"  # logs access log to stdout
workers = 1
bind = "0.0.0.0:80"
