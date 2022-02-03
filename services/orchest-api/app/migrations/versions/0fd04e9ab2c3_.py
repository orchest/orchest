"""empty message

Revision ID: 0fd04e9ab2c3
Revises: da828f0ba13b
Create Date: 2022-01-05 10:21:42.690454

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0fd04e9ab2c3"
down_revision = "da828f0ba13b"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        "ix_job_pipeline_runs_text_search",
        "pipeline_runs",
        [
            sa.text(
                "to_tsvector('simple', lower(CAST(pipeline_run_index AS TEXT)) || ' ' || CASE WHEN (status = 'STARTED') THEN 'running' WHEN (status = 'ABORTED') THEN 'cancelled' WHEN (status = 'FAILURE') THEN 'failed' ELSE lower(status) END || ' ' || lower(CAST(parameters AS TEXT)))"  # noqa
            )
        ],
        unique=False,
        postgresql_using="gin",
    )


def downgrade():
    op.drop_index(
        "ix_job_pipeline_runs_text_search",
        table_name="pipeline_runs",
        postgresql_using="gin",
    )
