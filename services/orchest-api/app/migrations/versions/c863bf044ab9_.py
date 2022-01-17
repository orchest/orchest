"""empty message

Revision ID: c863bf044ab9
Revises: 9eda3c5ad4f6
Create Date: 2022-01-13 12:09:39.994080

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "c863bf044ab9"
down_revision = "9eda3c5ad4f6"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        WITH run_param_values as (
        select run_values.uuid, jsonb_agg(run_values.value) as values from
        (select uuid, (jsonb_each(parameters)).* from pipeline_runs) as run_values
        group by uuid
        )
        UPDATE pipeline_runs
        SET parameters_text_search_values = run_param_values.values
        FROM run_param_values
        WHERE pipeline_runs.uuid = run_param_values.uuid;
        """
    )


def downgrade():
    op.execute("UPDATE pipeline_runs set parameters_text_search_values = '[]'::jsonb;")
