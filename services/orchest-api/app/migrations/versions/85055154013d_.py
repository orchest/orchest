"""Remove project, pipeline, env uuid unique constraint

Revision ID: 85055154013d
Revises: 8feeb577ca3f
Create Date: 2021-09-02 14:40:00.631116

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "85055154013d"
down_revision = "8feeb577ca3f"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint(
        "uq_interactive_session_image_mappings_project_uuid_pipe_4f1b",
        "interactive_session_image_mappings",
        type_="unique",
    )


def downgrade():
    op.create_unique_constraint(
        "uq_interactive_session_image_mappings_project_uuid_pipe_4f1b",
        "interactive_session_image_mappings",
        ["project_uuid", "pipeline_uuid", "orchest_environment_uuid"],
    )
