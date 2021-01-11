class CollateralFailure(Exception):
    pass


class FunctionFailure(Exception):
    pass


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
                print("Revert failed %s [%s]" % (e, type(e)))

    def __exit__(self, exc_type, exc_val, traceback):

        if exc_type is not None:
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
                # In case any collateral effect contains updates to the
                # db that were not committed yet.
                self.session.rollback()

                try:
                    # If any exception is raised when running the
                    # collateral effects try to revert the function.
                    self.revert(idx)
                except Exception as e:
                    # In case any revert call contains updates to the db
                    # that were not comitted yet.
                    self.session.rollback()
                    raise e
                raise e


class TwoPhaseFunction(object):
    def __init__(self, tpe):
        self.tpe = tpe
        self.orig_transaction = self.transaction
        self.transaction = self._transaction

    def _transaction(self, *args, **kwargs):

        try:
            res = self.orig_transaction(*args, **kwargs)
        except Exception as e:
            raise FunctionFailure(
                "Failed to run TwoPhaseFunction, error: %s [%s]" % (e, type(e))
            )

        self.tpe.collateral_queue.append(self)
        return res

    def transaction(self, *args, **kwargs):  # pylint: disable=E0202
        raise NotImplementedError()

    def collateral(self):
        raise NotImplementedError()

    def revert(self):
        pass
