"""Add JupyterImageBuildEvent model and event types

Revision ID: ad0b4cda3e50
Revises: 785f9995f297
Create Date: 2022-05-12 14:18:41.527142

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "ad0b4cda3e50"
down_revision = "785f9995f297"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        INSERT INTO event_types (name) values
        ('jupyter:image-build:created'),
        ('jupyter:image-build:started'),
        ('jupyter:image-build:cancelled'),
        ('jupyter:image-build:failed'),
        ('jupyter:image-build:succeeded')
        ;
        """
    )
    op.add_column(
        "events", sa.Column("build_uuid", sa.String(length=36), nullable=True)
    )
    op.create_foreign_key(
        op.f("fk_events_build_uuid_jupyter_image_builds"),
        "events",
        "jupyter_image_builds",
        ["build_uuid"],
        ["uuid"],
        ondelete="CASCADE",
    )


def downgrade():
    op.drop_constraint(
        op.f("fk_events_build_uuid_jupyter_image_builds"), "events", type_="foreignkey"
    )
    op.drop_column("events", "build_uuid")
