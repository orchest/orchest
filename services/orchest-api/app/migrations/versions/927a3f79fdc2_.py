"""Add EnvironmentImageBuild celery_task_uuid field

Revision ID: 927a3f79fdc2
Revises: d18edb41f574
Create Date: 2022-03-07 10:43:20.968445

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "927a3f79fdc2"
down_revision = "d18edb41f574"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "environment_image_builds",
        sa.Column("celery_task_uuid", sa.String(length=36), nullable=False),
    )


def downgrade():
    op.drop_column("environment_image_builds", "celery_task_uuid")
