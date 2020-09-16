import multiprocessing

accesslog = "/orchest/orchest/orchest-webserver/app/orchest-webserver.log"

workers = 1
threads = multiprocessing.cpu_count() - 1
bind = '0.0.0.0:80'