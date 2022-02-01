"""empty message

Revision ID: 97e836f74622
Revises: 8708c2c44585
Create Date: 2022-01-13 13:28:08.049155

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "97e836f74622"
down_revision = "8708c2c44585"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        "ix_job_pipeline_runs_text_search",
        "pipeline_runs",
        [
            sa.text(
                "to_tsvector('simple', lower(CAST(pipeline_run_index AS TEXT)) || ' ' || CASE WHEN (status = 'STARTED') THEN 'running' WHEN (status = 'ABORTED') THEN 'cancelled' WHEN (status = 'FAILURE') THEN 'failed' ELSE lower(status) END || ' ' || lower(CAST(parameters_text_search_values AS TEXT)))"  # noqa
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
