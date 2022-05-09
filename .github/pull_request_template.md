## Description

Description of what your PR solves or adds.

Fixes: #issue

## Checklist

- [ ] The documentation reflects the changes.
- [ ] The PR branch is set up to merge into `dev` instead of `master`.
- [ ] In case I changed one of the services’ `models.py` I have performed the appropriate database
      migrations (refer to `scripts/migration_manager.sh`).
- [ ] In case I changed code in the `orchest-sdk` I followed its [release
      checklist](https://github.com/orchest/orchest/blob/master/orchest-sdk/python/RELEASE-CHECKLIST.md)
- [ ] In case I changed code in the `orchest-cli` I followed its [release
      checklist](https://github.com/orchest/orchest/blob/master/orchest-cli/RELEASE-CHECKLIST.md)
- [ ] I haven't introduced breaking changes that would disrupt existing jobs, i.e. backwards
      compatibility is maintained.
- [ ] In case I changed the dependencies in any `requirements.in` I have run `pip-compile` to update
      the corresponding `requirements.txt`.
