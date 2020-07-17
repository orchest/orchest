@echo off

set HOST_CONFIG_DIR=%UserProfile%\.orchest\
set HOST_USER_DIR=%cd%\orchest\userdir\

REM create config dir if it doesn't exist
if not exist %HOST_CONFIG_DIR% mkdir %HOST_CONFIG_DIR%

REM orchest-ctl needs to bind to /userdir to make the duable queue directory automatically
docker run --name orchest-ctl --rm ^
    -v /var/run/docker.sock:/var/run/docker.sock -e HOST_CONFIG_DIR=%HOST_CONFIG_DIR% ^
    -e HOST_PWD=%cd% -e HOST_USER_DIR=%HOST_USER_DIR% orchestsoftware/orchest-ctl %*