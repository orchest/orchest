import logging
import sys
import asyncio

import cmdline
import config
import utils


def main():

    loop = asyncio.get_event_loop()

    utils.init_logger()

    available_cmds = cmdline.get_available_cmds()
    cmd_to_func = {cmd: getattr(cmdline, cmd) for cmd in available_cmds}

    # Run the appropriate command. If an invalid command is given, then
    # the `default_cmd` is run.
    default_cmd = "help"
    if len(sys.argv) <= 1:
        command = default_cmd
    else:
        command = sys.argv[1]

    if command not in available_cmds:
        logging.error("Command `%s` is not supported." % command)
        command = default_cmd
    else:
        if len(sys.argv) <= 2:
            # Do nothing.
            pass
        elif sys.argv[2] == "dev":
            config.RUN_MODE = "dev"
        elif sys.argv[2] == "web":
            config.UPDATE_MODE = "web"
        elif "port" in sys.argv[2]:
            # port_spec is something like "--port=8080"
            port_spec = sys.argv[2]
            port = int(port_spec.split('=')[-1])
            config.CONTAINER_MAPPING["orchestsoftware/nginx-proxy:latest"]["ports"] = {
                "80/tcp": port,
                "443/tcp": 443,
            }

    cmd_to_func[command]()

    loop.close()


if __name__ == '__main__':
    main()
