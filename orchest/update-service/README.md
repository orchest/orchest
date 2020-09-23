## update-service

This is a stand-alone nginx Flask application that is responsible for updating
Orchest.

Since it's detached from the Orchest microservice application it can
update the full application.

For authentication it relies on the auth-server service of Orchest. Hence, it
can only be initiated when Orchest is running.

It runs on port 9000 with SSL enabled (nginx)