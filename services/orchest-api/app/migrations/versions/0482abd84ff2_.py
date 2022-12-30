"""Add SSHKey model.

Revision ID: 0482abd84ff2
Revises: a7df709869a5
Create Date: 2022-12-21 11:57:27.981658

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0482abd84ff2"
down_revision = "a7df709869a5"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ssh_keys",
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column("auth_user_uuid", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column(
            "created_time",
            sa.DateTime(),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["auth_user_uuid"],
            ["auth_users.uuid"],
            name=op.f("fk_ssh_keys_auth_user_uuid_auth_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("uuid", name=op.f("pk_ssh_keys")),
    )
    op.create_index(
        op.f("ix_ssh_keys_auth_user_uuid"), "ssh_keys", ["auth_user_uuid"], unique=False
    )


def downgrade():
    op.drop_index(op.f("ix_ssh_keys_auth_user_uuid"), table_name="ssh_keys")
    op.drop_table("ssh_keys")
