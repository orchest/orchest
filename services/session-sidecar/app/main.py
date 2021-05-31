import logging
import os
import re
import socketserver
import uuid

from config import Config


def get_log_dir_path():
    return os.path.join(
        Config.PROJECT_DIR,
        Config.LOGS_PATH.format(pipeline_uuid=os.environ["ORCHEST_PIPELINE_UUID"]),
    )


def get_service_log_file_path(service):
    return os.path.join(get_log_dir_path(), f"{service}.log")


def create_log_dir():
    log_dir_path = get_log_dir_path()
    if not os.path.exists(log_dir_path):
        try:
            os.makedirs(log_dir_path)
        except OSError as exc:
            raise exc


def get_service_name_from_log(log_line):
    metadata_regex = r"-metadata-end\[\d+\]"
    name_end = re.search(metadata_regex, log_line).start()
    prefix = "user-service-"
    name_start = log_line.find(prefix) + len(prefix)
    return log_line[name_start:name_end]


class TCPHandler(socketserver.StreamRequestHandler):
    def handle(self):
        # A new container has started logging, we can write instead of
        # append since the TCP connection is opened on container start
        # and closed on container end.

        # Use the first metadata to get the service name.
        logging.info(f"Received connection: {self.connection}")
        data = self.rfile.readline()
        service_name = get_service_name_from_log(bytes.decode(data))
        logging.info(f"{service_name} sent its first data.")

        with open(get_service_log_file_path(service_name), "w") as log_file:
            # Used by the log_streamer.py to infer that a new session
            # has started, i.e. the previous logs can be discarded.
            log_file.write("%s\n" % str(uuid.uuid4()))
            log_file.flush()

            while data != b"":
                data = bytes.decode(data)
                # Docker will split messages past this size into
                # multiple messages.  Every message has a newline
                # appended, and if the message already ends with a
                # newline no newline will be appended. This means that
                # the only way to know if the ending newline is "real"
                # or not is to check the length, note that there could
                # be a false positive if a message with a newline has
                # exactly this length.
                if len(data) == 16456 and data[-1] == "\n":
                    data = data[:-1]
                # Remove syslog metadata. Note: this is faster than
                # using a regex but less safe. TODO: decide what to
                # use.
                data = data[data.find("]: ") + 3 :]
                log_file.write(data)
                log_file.flush()
                data = self.rfile.readline()

        logging.info(f"{service_name} disconnected.")


if __name__ == "__main__":
    logging.getLogger().setLevel(logging.INFO)

    logs_path = get_service_log_file_path("<service>")
    logging.info(f"Storing logs in {logs_path}")
    create_log_dir()

    HOST = "0.0.0.0"
    PORT = 1111
    logging.info(f"Listening on {HOST}:{PORT}")
    with socketserver.ThreadingTCPServer((HOST, PORT), TCPHandler) as server:
        server.request_queue_size = 1000
        server.serve_forever()
