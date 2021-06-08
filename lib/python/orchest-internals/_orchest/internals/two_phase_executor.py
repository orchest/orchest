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
a TwoPhaseFunction means implementing a _transaction and a _collateral
function. The user of a TwoPhaseFunction is in charge of creating the
context and calling TwoPhaseFunction.transaction(*args, **kwargs), while
the TwoPhaseExecutor will take care of making it so that a commit will
happen after all transactional code has executed, and will take care of
calling the collateral part of each TwoPhaseFunction for which the
transaction call has been made in the context.
Example:

try:
    with TwoPhaseExecutor(db.session) as tpe:
        could_abort = AbortEnvironmentBuild(tpe).transaction(
            environment_build_uuid
        )
except Exception as e:
    current_app.logger.error(e)
    return {"message": str(e)}, 500


Note that you should not call commit inside the _transaction method,
while you are free to do so if you need to apply db changes during the
collateral phase, and cannot do otherwise.
"""

import logging
import traceback
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

    def __exit__(self, exc_type, exc_val, tb):

        if exc_type is not None:
            logger.error(f"Error during transactional phase: {exc_val} [{exc_type}]")
            logger.error("".join(traceback.format_tb(tb)))
            # Rollback the transaction if any exception was raised
            # during the execution of the first phase.
            self.session.rollback()
            raise exc_val
        else:
            self.session.commit()

        for idx, tpf in enumerate(self.collateral_queue):
            try:
                # Unpack tpf.data as kwargs to be passed to the
                # collateral function.
                tpf.collateral(**tpf.collateral_kwargs)
            except Exception as e:
                logger.error(f"Error during collateral phase: {e}")
                traceback.print_exc()
                # In case any collateral effect contains updates to the
                # db that were not committed yet.
                self.session.rollback()

                # If any exception is raised when running the
                # collateral effects try to revert every function.
                self.revert(idx)
                raise e


class TwoPhaseFunctionException(Exception):
    pass


class TransactionHasBeenRunTwice(Exception):
    pass


class CollateralHasBeenRunTwice(Exception):
    pass


class RevertHasBeenRunTwice(Exception):
    pass


class TwoPhaseFunction(ABC):
    """A class to keep database and collateral effects separated.

    Use this class (combined with TwoPhaseExecutor) to have
    transactional effects happen before collateral effects. Assuming a
    TwoPhaseFunction is executed in the context of a TwoPhaseExecutor,
    the _transaction method must not commit, given that all the combined
    _transaction methods of the TwoPhaseFunctions that are run in the
    context of a TwoPhaseExecutor are considered to be part of the same
    transaction, so that errors during the transactional phase can be
    solved by issuing a rollback of the entire transaction. Similarly,
    the _transaction method does not have (nor need) to rollback, since
    any uncaught exception during the transactional phase will bubble
    up to the TwoPhaseExecutor, which will take care of that. The
    _collateral and _revert functions are free to commit and rollback,
    given that whatever happens in their body is considered a collateral
    effect and not part of a transaction. This mean that they must take
    care of their own commits. Taking care of rollbacks is optional
    since the TwoPhaseExecutor will rollback if any exception raises
    during a _collateral() or _revert() call. All in all, this means
    that:
    - _transaction: must not commit, rollback not necessary
    - _collateral: should commit it's own changes, rollback not
        necessary
    - _revert: should commit it's own changes, rollback not necessary

    When implementing the transaction and collateral functions be sure
    to use the self.collateral_kwargs dictionary to pass data from the
    transaction function to the collateral function. The dictionary
    will be unpacked as kwargs when calling _collateral. The _revert
    function will instead have to use the dictionary directly, since
    it might not be guaranteed what kwargs get to the dictionary in case
    the _collateral function fails before setting any.

    TODO: find a way to detect if a commit has happened in the
    transactional phase, i.e. if any transaction is calling commit on
    its own.

    """

    def __init__(self, tpe):
        self.tpe = tpe
        self.collateral_kwargs = {}

        self._has_run_transaction = False
        self._has_run_collateral = False
        self._has_run_revert = False

    def transaction(self, *args, **kwargs):
        if self._has_run_transaction:
            raise TransactionHasBeenRunTwice()

        self._has_run_transaction = True
        self.tpe.collateral_queue.append(self)
        return self._transaction(*args, **kwargs)

    def collateral(self, **kwargs):
        if self._has_run_collateral:
            raise CollateralHasBeenRunTwice()

        self._has_run_collateral = True
        self._collateral(**kwargs)

    def revert(self):
        if self._has_run_revert:
            raise RevertHasBeenRunTwice()

        self._has_run_revert = True
        self._revert()

    @abstractmethod
    def _transaction(self, *args, **kwargs):
        pass

    @abstractmethod
    def _collateral(self, **kwargs):
        pass

    def _revert(self):
        pass
