"""empty message

Revision ID: bab71acdcd61
Revises: 92dcc9963a9c
Create Date: 2022-04-25 10:31:20.127044

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "bab71acdcd61"
down_revision = "92dcc9963a9c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("events", sa.Column("run_index", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_events_type"), "events", ["type"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_events_type"), table_name="events")
    op.drop_column("events", "run_index")
