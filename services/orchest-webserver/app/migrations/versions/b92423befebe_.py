"""Remove unusued PipelineRuns table

Revision ID: b92423befebe
Revises: 5d7c6a1edaa7
Create Date: 2021-01-21 10:39:38.723084

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "b92423befebe"
down_revision = "5d7c6a1edaa7"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table("pipelineruns")


def downgrade():
    op.create_table(
        "pipelineruns",
        sa.Column("uuid", sa.VARCHAR(length=255), autoincrement=False, nullable=False),
        sa.Column("id", sa.INTEGER(), autoincrement=False, nullable=True),
        sa.Column(
            "parameter_json",
            postgresql.JSON(astext_type=sa.Text()),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column("job", sa.VARCHAR(length=255), autoincrement=False, nullable=True),
        sa.ForeignKeyConstraint(
            ["job"], ["jobs.uuid"], name="fk_pipelineruns_job_jobs", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("uuid", name="pk_pipelineruns"),
    )
