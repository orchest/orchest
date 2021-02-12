import uuid


def uuid4():
    return str(uuid.uuid4())


class CeleryMock:
    def __init__(self):
        self.tasks = []
        self.revoked_tasks = []
        self.control = self

    def send_task(self, *args, **kwargs):
        self.tasks.append(
            (
                args,
                kwargs,
            )
        )
        return self

    def forget(self):
        pass

    def revoke(self, *args, **kwargs):
        self.revoked_tasks.append(args[0])


class AbortableAsyncResultMock:
    def __init__(self, *args, **kwargs):
        self.task_id = args[0]
        self.aborted = False

    def abort(self):
        self.aborted = True

    def is_aborted(self):
        return self.aborted
