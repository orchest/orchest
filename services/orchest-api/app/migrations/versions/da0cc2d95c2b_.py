"""Add ImageToBeDeletedFromTheRegistry model

Revision ID: da0cc2d95c2b
Revises: 7189e327c98a
Create Date: 2022-04-13 08:03:39.297185

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "da0cc2d95c2b"
down_revision = "7189e327c98a"
branch_labels = None
depends_on = None


def upgrade():
    table_name = "images_to_be_deleted_from_the_registry"
    op.create_table(
        table_name,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("digest", sa.String(length=71), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f(f"pk_{table_name}")),
    )
    op.create_index(
        op.f(f"ix_{table_name}_digest"),
        table_name,
        ["digest"],
        unique=False,
    )
    op.create_index(
        op.f(f"ix_{table_name}_name"),
        table_name,
        ["name"],
        unique=False,
    )


def downgrade():
    table_name = "images_to_be_deleted_from_the_registry"
    op.drop_index(op.f(f"ix_{table_name}_name"), table_name=table_name)
    op.drop_index(op.f(f"ix_{table_name}_digest"), table_name=table_name)
    op.drop_table(table_name)
