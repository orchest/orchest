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
        if len(sys.argv) > 2:
            if sys.argv[2] == "dev":
                config.RUN_MODE = "dev"

    cmd_to_func[command]()

    loop.close()


if __name__ == '__main__':
    main()
