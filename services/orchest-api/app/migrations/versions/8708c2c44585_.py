"""empty message

Revision ID: 8708c2c44585
Revises: c863bf044ab9
Create Date: 2022-01-13 12:52:07.266720

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "8708c2c44585"
down_revision = "c863bf044ab9"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index(
        "ix_job_pipeline_runs_text_search",
        table_name="pipeline_runs",
        postgresql_using="gin",
    )


def downgrade():
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
