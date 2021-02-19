import uuid


def gen_uuid(use_underscores=False):
    res = str(uuid.uuid4())
    if use_underscores:
        res.replace("-", "_")
    return res


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
        if args:
            self.task_id = args[0]
        else:
            self.task_id = kwargs["task_id"]

        self.aborted = False

    def abort(self):
        self.aborted = True

    def is_aborted(self):
        return self.aborted
