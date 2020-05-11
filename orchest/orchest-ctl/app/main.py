import logging
import sys
import docker


VALID_COMMANDS = {
    "start": "Starts the Orchest application",
    "help": "Shows this help menu"
}


def start():
    logging.info("Stub: starting Orchest")

    client = docker.from_env()
    print(client.containers.list())


def help_func():
    for key in VALID_COMMANDS:
        print("%s\t\t %s" % (key, VALID_COMMANDS[key]))


def main():

    logging.basicConfig(level=logging.INFO)

    command_to_func = {
        "start": start,
        "help": help_func
    }

    # deafult command
    command = "start"

    if len(sys.argv) > 1:
        command = sys.argv[1]

    if command not in VALID_COMMANDS.keys():
        logging.error("Command %s is not supported. Use `orchest help` to get a list of commands." % command)
        return

    
    command_to_func[command]()


if __name__ == '__main__':

    # execute only if run as a script
    main()