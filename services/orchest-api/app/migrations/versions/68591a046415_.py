"""Add GitImport model

Revision ID: 68591a046415
Revises: 4aee53e26a92
Create Date: 2022-12-20 10:40:56.722203

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "68591a046415"
down_revision = "4aee53e26a92"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "git_imports",
        sa.Column(
            "uuid",
            sa.String(length=36),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("requested_name", sa.String(length=255), nullable=True),
        sa.Column("project_uuid", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=15), nullable=False),
        sa.Column(
            "result",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["project_uuid"],
            ["projects.uuid"],
            name=op.f("fk_git_imports_project_uuid_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("uuid", name=op.f("pk_git_imports")),
    )


def downgrade():
    op.drop_table("git_imports")
