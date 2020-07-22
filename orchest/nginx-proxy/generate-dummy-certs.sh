openssl genrsa -out server.key 2048

openssl req -new -key server.key -out cert.csr -subj "/C=NL/ST=Zuid Holland/L=Rotterdam/O=Orchest Software, Inc./OU=IT Department/CN=orchest.io"

openssl x509 -in cert.csr -out server.crt -req -signkey server.key -days 365