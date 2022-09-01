"""Perform Job.snapshot_uuid data migration

This is needed to backfill snapshots db entries for existing jobs.

Revision ID: 7beba3ba9e66
Revises: 8e05af5f2b06
Create Date: 2022-08-29 08:44:41.107905

"""
import uuid

import sqlalchemy as sa
import sqlalchemy.orm as orm
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base

revision = "7beba3ba9e66"
down_revision = "8e05af5f2b06"
branch_labels = None
depends_on = None

Base = declarative_base()


class MigrationProjectModel(Base):
    __tablename__ = "projects"

    uuid = sa.Column(sa.String(36), primary_key=True)


class MigrationSnapshotModel(Base):
    __tablename__ = "snapshots"

    uuid = sa.Column(sa.String(36), primary_key=True)

    project_uuid = sa.Column(
        sa.String(36),
        sa.ForeignKey("projects.uuid", ondelete="CASCADE"),
    )

    pipelines = sa.Column(
        JSONB,
    )

    project_env_variables = sa.Column(
        JSONB,
    )
    pipelines_env_variables = sa.Column(
        JSONB,
    )


class MigrationJobsModel(Base):
    __tablename__ = "jobs"

    uuid = sa.Column(sa.String(36), primary_key=True)
    project_uuid = sa.Column(
        sa.String(36),
    )

    pipeline_name = sa.Column(sa.String(255))
    pipeline_uuid = sa.Column(sa.String(36))

    pipeline_definition = sa.Column(
        JSONB,
    )

    env_variables = sa.Column(
        JSONB,
    )

    pipeline_run_spec = sa.Column(
        JSONB,
    )

    snapshot_uuid = sa.Column(
        sa.String(36),
    )


def upgrade():
    bind = op.get_bind()
    session = orm.Session(bind=bind)

    # For every job we create the snapshot which it runs on.
    for job in session.query(MigrationJobsModel).all():
        print(f"Migrating job {job.uuid}.")
        snapshot = MigrationSnapshotModel(
            uuid=str(uuid.uuid4()),
            project_uuid=job.project_uuid,
            pipelines={
                job.pipeline_uuid: {
                    "path": job.pipeline_run_spec["run_config"]["pipeline_path"],
                    "definition": job.pipeline_definition,
                }
            },
            project_env_variables=job.env_variables,
            pipelines_env_variables={job.pipeline_uuid: job.env_variables},
        )
        session.add(snapshot)
        session.flush()
        job.snapshot_uuid = snapshot.uuid

    session.commit()


def downgrade():
    pass
