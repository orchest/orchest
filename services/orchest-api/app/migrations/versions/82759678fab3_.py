"""empty message

Revision ID: 82759678fab3
Revises: bdfd2575597b
Create Date: 2022-03-04 15:47:29.898666

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "82759678fab3"
down_revision = "bdfd2575597b"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "jupyter_image_builds",
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column("requested_time", sa.DateTime(), nullable=False),
        sa.Column("started_time", sa.DateTime(), nullable=True),
        sa.Column("finished_time", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(length=15), nullable=True),
        sa.PrimaryKeyConstraint("uuid", name=op.f("pk_jupyter_image_builds")),
    )
    op.drop_table("jupyter_builds")


def downgrade():
    op.create_table(
        "jupyter_builds",
        sa.Column("uuid", sa.VARCHAR(length=36), autoincrement=False, nullable=False),
        sa.Column(
            "requested_time",
            postgresql.TIMESTAMP(),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "started_time", postgresql.TIMESTAMP(), autoincrement=False, nullable=True
        ),
        sa.Column(
            "finished_time", postgresql.TIMESTAMP(), autoincrement=False, nullable=True
        ),
        sa.Column("status", sa.VARCHAR(length=15), autoincrement=False, nullable=True),
        sa.PrimaryKeyConstraint("uuid", name="pk_jupyter_builds"),
    )
    op.drop_table("jupyter_image_builds")
