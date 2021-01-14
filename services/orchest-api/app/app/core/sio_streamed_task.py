import logging
import os
import select
import signal
import threading
import time

import socketio


# TODO: move this to util?
class UnbufferedTextStream(object):
    """A wrapper around a file object.

    Makes sure writing is unbuffered even if in TEXTIO mode.

    """

    def __init__(self, stream):
        self.stream = stream

    def write(self, data):
        self.stream.write(data)
        self.stream.flush()

    def writelines(self, datas):
        self.stream.writelines(datas)
        self.stream.flush()

    def __getattr__(self, attr):
        return getattr(self.stream, attr)


class SioStreamedTask:
    MAX_READ_BYTES = 1024 * 20
    READ_LOOP_SLEEP_TIME = 0.01

    @staticmethod
    def run(
        task_lambda,
        identity,
        server,
        namespace,
        abort_lambda,
        abort_lambda_poll_time=0.2,
    ):
        """Stream the logs of a task to a Socketio server and namespace.

        Given a lambda which takes a file object argument, forward
        whatever is written by the task to the file object to the
        specified socketio server and namespace.  The emitted messages
        are of the type/name "sio_streamed_task_data".  First, a
        starting message is sent:
            {
                "identity": identity
                "action": "sio_streamed_task_started"
            }
        Then, an arbitrary number of messages containing the task_lambda
        output are sent, where task_data is a chunk of bytes read from
        the file object to which the task_lambda is writing.
            {
                "identity": identity,
                "output": task_data,
                "action": "sio_streamed_task_output",
            }
        Once the task is done, a closing message is sent:
            {
                "identity": self.identity,
                "action": "sio_streamed_task_finished"
            }
        The identity, which is an object which needs to respect the
        socketio requirements (basic stuff like primitive types,
        strings, lists, dict, etc.), is used to be able to distinguish
        messages that are related to different tasks, e.g. by the
        server.


        Args:
            identity: An object that respects the socketio requirements
                for serialization that can be used to distinguish
                messages related to different tasks but that are sent to
                the same namespace, e.g. to do some server side
                discrimination based on the application.
            server: SocketIO server to which messages are sent.
            namespace: SocketIO namespace to which messages are sent.
            task_lambda: A lambda that takes only one argument, a file
                object. Anything written to this file object will be
                forwarded to the SocketIO server in an unbuffered
                manner.  The value returned by the task_lambda, after
                transforming it to a string, will be returned by this
                function.
            abort_lambda (optional): Returns True if the task should be
                aborted, interrupting the task_lambda and closing
                communication with the SocketIO server.
            abort_lambda_poll_time (optional): How often the
                abort_lambda should be queried.

        Returns:
            Stringified result of the task_lambda, e.g.
            str(task_lambda(file_object)). If the task gets aborted
            because abort_task() == True then "ABORTED". In the case of
            an exception the result will be "FAILED".
        """

        end_task_pipe_read, end_task_pipe_write = os.pipe()
        communication_pipe_read, communication_pipe_write = os.pipe()
        child_pid = os.fork()

        if child_pid == 0:
            os.close(communication_pipe_read)
            os.close(end_task_pipe_read)
            SioStreamedTask._run_lambda(
                task_lambda, communication_pipe_write, end_task_pipe_write
            )

        else:
            os.close(communication_pipe_write)
            os.close(end_task_pipe_write)
            return SioStreamedTask._listen_to_logs(
                child_pid,
                identity,
                server,
                namespace,
                abort_lambda,
                abort_lambda_poll_time,
                communication_pipe_read,
                end_task_pipe_read,
            )

    @staticmethod
    def _run_lambda(task_lambda, communication_pipe_write, end_task_pipe_write):
        """Code path of the forked child which runs the task lambda.

        Args:
            task_lambda:
            communication_pipe_write:
            end_task_pipe_write:

        Returns:

        """

        communication_pipe_write = UnbufferedTextStream(
            os.fdopen(communication_pipe_write, "w")
        )
        end_task_pipe_write = UnbufferedTextStream(os.fdopen(end_task_pipe_write, "w"))

        result = "FAILED"
        # use a try catch block so that even if there are errors in the
        # task lambda we still send the closing message in end_task_pipe
        try:
            result = task_lambda(communication_pipe_write)
        except Exception as e:
            logging.error(e)
        finally:
            communication_pipe_write.flush()

            # the parent will now know that the child can be killed
            end_task_pipe_write.write(str(result))
            end_task_pipe_write.flush()

            # cleanup this end of the pipe
            communication_pipe_write.close()
            end_task_pipe_write.close()
            # this way the process does not exit and triggers celery
            # stuff without control, we kill it ourselves
            time.sleep(10)

    @staticmethod
    def _listen_to_logs(
        child_pid,
        identity,
        server,
        namespace,
        abort_lambda,
        abort_lambda_poll_time,
        communication_pipe_read,
        end_task_pipe_read,
    ):
        """Listens on the pipe(s) to send to SocketIO server.

        Code path of the parent which listens on the pipe(s) for logs to
        send to the SocketIO server.

        Args:
            child_pid:
            identity:
            server:
            namespace:
            abort_lambda:
            abort_lambda_poll_time:
            communication_pipe_read:
            end_task_pipe_read:

        Returns:

        """

        sio_client = socketio.Client(reconnection_attempts=1)

        # used to make sure the client is connected to the namespace
        # before sending the first message otherwise the message might
        # get lost
        # https://github.com/miguelgrinberg/python-socketio/issues/461
        connect_lock = threading.Lock()
        # get the lock so the next call to it will block the thread even
        # if it is the same thread acquiring it, since its NOT a RLock
        connect_lock.acquire()

        @sio_client.on("connect", namespace=namespace)
        def connect():
            logging.info("connected to namespace %s" % namespace)
            # https://docs.python.org/2/library/threading.html#threading.Lock
            # any thread may release it
            connect_lock.release()

        sio_client.connect(server, namespaces=[namespace], transports=["websocket"])

        # try to acquire again, if it has not been released yet wait for
        # it wait a maximum of 10 seconds, if that doesnt work declare
        # the build as failed, because that means that it took more than
        # 10 seconds for the client to connect to the namespace
        acquired = connect_lock.acquire(timeout=10)
        # release the lock in any case, cleaner
        connect_lock.release()
        if not acquired:
            logging.warning("could not acquire connect_lock")
            return "FAILED"

        # tell the socketio server that from its point of view the task
        # is started, i.e.  new logs related to this identity will come
        # in
        sio_client.emit(
            "sio_streamed_task_data",
            {"identity": identity, "action": "sio_streamed_task_started"},
            namespace=namespace,
        )

        status = "STARTED"
        poll_time = 0
        management_data = None

        try:
            while True:
                sio_client.sleep(SioStreamedTask.READ_LOOP_SLEEP_TIME)
                poll_time += SioStreamedTask.READ_LOOP_SLEEP_TIME

                # check for management_data here, this way:
                # * if there is no management_data business continues as
                #   usual
                # * if there is management_data we are also going to
                #   check for any task data, this way we
                # * avoid a race condition where checking for task_data
                #   first and management_data later might
                # * lead to losing some messages because in between the
                #   two checks the task has both
                # * outputted data and has terminated
                if not management_data:
                    management_data = SioStreamedTask.poll_fd_data(end_task_pipe_read)

                task_data = SioStreamedTask.poll_fd_data(communication_pipe_read)
                if task_data:
                    logging.info("output: %s" % task_data)
                    sio_client.emit(
                        "sio_streamed_task_data",
                        {
                            "identity": identity,
                            "output": task_data,
                            "action": "sio_streamed_task_output",
                        },
                        namespace=namespace,
                    )

                    # this way we do not run the (rare) risk of missing
                    # out on some data because the amount of data in the
                    # pipe is larger than our read size. It could be the
                    # case that the task outputs **a lot** of data
                    # without the parent being able to keep up with it,
                    # and the task terminates, so the next iteration
                    # would lead to exiting the loop regardless of the
                    # amount of data that could still be read.
                    # TLDR: do not terminate as long as you keep finding
                    # data
                    has_found_data = True
                else:
                    has_found_data = False

                # from time to time check if the task should be aborted
                if poll_time > abort_lambda_poll_time:
                    abort_lambda_poll_time = 0
                    if abort_lambda():
                        status = "ABORTED"
                        logging.info("aborting task")
                        break

                # management_data has been found -> the task is done ->
                # any data that it had to write has already been put
                # into the communication_pipe_read
                if management_data and not has_found_data:
                    logging.info(f"task done, status: {management_data}")
                    status = management_data
                    break

        except Exception as ex:
            logging.warning("Exception during execution: %s" % ex)
            status = "FAILED"
        finally:
            # Cleanup phase. Close the pipes, emit a closing message,
            # kill the child process.

            # currently getting broken pipes on disconnect at random,
            # the sleep is helping to make it so that the last message
            # is delivered Seems like it's an issue related to the
            # library?
            # https://github.com/miguelgrinberg/python-engineio/commit/0dde7d7ae19478a56610b3a06f76419013e60d62
            # I am able to reproduce the problem by using the client
            # example in the docs. By replacing the wait call with
            # disconnect.
            # (https://python-socketio.readthedocs.io/en/latest/intro.html#client-examples)
            sio_client.emit(
                "sio_streamed_task_data",
                {"identity": identity, "action": "sio_streamed_task_finished"},
                namespace=namespace,
                callback=lambda: sio_client.disconnect(),
            )

            os.kill(child_pid, signal.SIGKILL)
            # close after killing so the child process does not get into
            # errors
            os.close(communication_pipe_read)
            os.close(end_task_pipe_read)
            logging.info("[Killed] child_pid: %d" % child_pid)

        return status

    @staticmethod
    def poll_fd_data(fd):
        (data_ready, _, _) = select.select([fd], [], [], 0)
        if data_ready:
            output = os.read(fd, SioStreamedTask.MAX_READ_BYTES).decode()
            return output
        return None
