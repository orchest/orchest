import uuid
from typing import Any, Callable, Optional


def raise_exception_function(
    exception: Optional[Exception] = None,
    should_trigger: Optional[Callable[[], bool]] = None,
    return_value: Optional[Any] = None,
) -> Callable[[Any], Any]:
    """Returns a function that will raise an exception.

    Args:
        exception: The exception to raise.
        should_trigger: If the specified exception should be raised by
            the returned function when it is called. This can be used to
            have fine grained control on when the specified exception is
            raised.
        return_value: What the returned function should return when
            called if the specified exception is not to be raised. When
            passing a return_value a should_trigger callable must be
            passed as well.

    Returns:
        Returns a function that will raise an exception when called. If
        should_trigger is defined the specified exception will be raised
        only if should_trigger returns True.
    """
    if exception is None:
        exception = Exception()

    if should_trigger is None and return_value is not None:
        raise ValueError(
            "Must pass a should_trigger callable when passing" " a return value."
        )

    def f(*args, **kwargs):
        if should_trigger is not None and not should_trigger():
            return return_value

        raise exception

    return f


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
