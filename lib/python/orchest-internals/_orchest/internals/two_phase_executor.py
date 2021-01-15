"""Classes to support the transaction first, collaterals later pattern.

The TwoPhaseExecutor helps in creating a context where committing and
rollbacking in case of error is taken care of. This pattern wants to
encourage having changes to the DB in a single transaction, so that a
rollback can be issued if any error arises during the transactional
phase, leaving the state clean. Moreover, this pattern wants to
encourage having collateral effecs into a second phase, the collateral
one. The separation between DB changes and collateral effects should
help in making the code clearer, easier to debug and to test, while
improving the capacity of leaving a consistent state in case of error.
The pattern works through the use of TwoPhaseFunction(s). Implementing
a TwoPhaseFunction means implementing a transaction and a collateral
function. The user of a TwoPhaseFunction is in charge of creating the
context and calling 2phase_function.transaction(*args, **kwargs), while
the TwoPhaseExecutor will take care of making it so that a commit will
happen after all transactional code has execute, and will take core of
calling the collateral part of each TwoPhaseFunction for which the
transation call has been made in the context.
Example:

try:
    with TwoPhaseExecutor(db.session) as tpe:
        could_abort = AbortEnvironmentBuild(tpe).transaction(
            environment_build_uuid
        )
except Exception as e:
    current_app.logger.error(e)
    return {"message": str(e)}, 500


Note that you should not call commit during any implementation of the
transaction method, while you are free to do so if you need to apply db
changes during the collateral phase, and cannot do otherwise.
"""

import logging
from abc import ABC, abstractmethod

# See the logging config that is setup by the orchest-api, webserver,
# auth-server on initialization for the specific settings.
logger = logging.getLogger("orchest-lib")


class TwoPhaseExecutor(object):
    def __init__(self, session):
        self.session = session
        self.collateral_queue = []

    def __enter__(self):
        return self

    def revert(self, failed_idx):
        for i in range(failed_idx, -1, -1):
            try:
                self.collateral_queue[i].revert()
            except Exception as e:
                logger.error(f"Error during revert call {i}: {e}")
                # In case any revert call contains updates to the db
                # that were not comitted yet.
                self.session.rollback()

    def __exit__(self, exc_type, exc_val, traceback):

        if exc_type is not None:
            logger.error(f"Error during transactional phase: {exc_val}")
            # Rollback the transaction if any exception was raised
            # during the execution of the first phase.
            self.session.rollback()
            raise exc_val
        else:
            self.session.commit()

        for idx, tpf in enumerate(self.collateral_queue):
            try:
                tpf.collateral()
            except Exception as e:
                logger.error(f"Error during collateral phase: {e}")
                # In case any collateral effect contains updates to the
                # db that were not committed yet.
                self.session.rollback()

                # If any exception is raised when running the
                # collateral effects try to revert every function.
                self.revert(idx)
                raise e


class TwoPhaseFunction(ABC):
    """A class to keep database and collateral effects separated.

    Use this class (combined with TwoPhaseExecutor) to have
    transactional effects happen before collateral effects. Assuming a
    TwoPhaseFunction is executed in the context of a TwoPhaseExecutor,
    the transaction method must not commit, given that all the combined
    transaction methods of the TwoPhaseFunctions that are run in the
    context of a TwoPhaseExecutor are considered to be part of the same
    transaction, so that errors during the transactional phase can be
    solved by issuing a rollback of the entire transaction. Similarly,
    the transaction method does not have (nor need) to rollback, since
    any uncaught exception during the transactional phase will bubble
    up to the TwoPhaseExecutor, which will take care of that. The
    collateral and revert functions are free to commit and rollback,
    given that whatever happens in their body is considered a collateral
    effect and not part of a transaction. This mean that they must take
    care of their own commits. Taking care of rollbacks is optional
    since the TwoPhaseExecutor will rollback if any exception raises
    during a collateral() or revert call(). All in all, this means that:
    - transaction: must not commit, rollback not necessary
    - collateral: should commit it's own changes, rollback not necessary
    - revert: should commit it's own changes, rollback not necessary

    TODO: find a way to detect if a commit has happened in the
    transactional phase, i.e. if any transaction is calling commit on
    its own.

    """

    def __init__(self, tpe):
        self.tpe = tpe
        self._orig_transaction = self.transaction
        self.transaction = self._transaction

    def _transaction(self, *args, **kwargs):

        self.tpe.collateral_queue.append(self)
        return self._orig_transaction(*args, **kwargs)

    @abstractmethod
    def transaction(self, *args, **kwargs):  # pylint: disable=E0202
        pass

    @abstractmethod
    def collateral(self):
        pass

    def revert(self):
        pass
