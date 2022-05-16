"""Remove the ImagesToBeDeletedFromTheRegistry model

Revision ID: b5feeffd0ace
Revises: 4694f9241649
Create Date: 2022-04-15 09:15:04.554357

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "b5feeffd0ace"
down_revision = "4694f9241649"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index(
        "ix_images_to_be_deleted_from_the_registry_digest",
        table_name="images_to_be_deleted_from_the_registry",
    )
    op.drop_index(
        "ix_images_to_be_deleted_from_the_registry_name",
        table_name="images_to_be_deleted_from_the_registry",
    )
    op.drop_table("images_to_be_deleted_from_the_registry")


def downgrade():
    op.create_table(
        "images_to_be_deleted_from_the_registry",
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("name", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("digest", sa.VARCHAR(length=71), autoincrement=False, nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_images_to_be_deleted_from_the_registry"),
    )
    op.create_index(
        "ix_images_to_be_deleted_from_the_registry_name",
        "images_to_be_deleted_from_the_registry",
        ["name"],
        unique=False,
    )
    op.create_index(
        "ix_images_to_be_deleted_from_the_registry_digest",
        "images_to_be_deleted_from_the_registry",
        ["digest"],
        unique=False,
    )
