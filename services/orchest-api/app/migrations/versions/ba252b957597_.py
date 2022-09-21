"""Add Snapshot model

Revision ID: ba252b957597
Revises: 3433a9040ff4
Create Date: 2022-08-29 08:23:43.437292

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "ba252b957597"
down_revision = "3433a9040ff4"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "snapshots",
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "timestamp",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("project_uuid", sa.String(length=36), nullable=False),
        sa.Column("pipelines", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "project_env_variables",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "pipelines_env_variables",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["project_uuid"],
            ["projects.uuid"],
            name=op.f("fk_snapshots_project_uuid_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("uuid", name=op.f("pk_snapshots")),
    )
    op.create_index(
        op.f("ix_snapshots_project_uuid"), "snapshots", ["project_uuid"], unique=False
    )


def downgrade():
    op.drop_index(op.f("ix_snapshots_project_uuid"), table_name="snapshots")
    op.drop_table("snapshots")
