"""'token' is the new primary key for the Token model

Revision ID: fe9a960dc117
Revises: 9376105c8654
Create Date: 2022-06-29 10:23:56.857548

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "fe9a960dc117"
down_revision = "9376105c8654"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("alter table tokens drop constraint pk_tokens cascade")
    op.create_primary_key("pk_tokens", "tokens", ["token"])


def downgrade():
    op.execute("alter table tokens drop constraint pk_tokens cascade")
    op.create_primary_key("pk_tokens", "tokens", ["user"])
