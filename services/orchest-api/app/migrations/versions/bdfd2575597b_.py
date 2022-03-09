"""empty message

Revision ID: bdfd2575597b
Revises: 9968c09b5434
Create Date: 2022-03-04 15:34:23.768780

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "bdfd2575597b"
down_revision = "9968c09b5434"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index(
        "ix_environment_builds_environment_uuid", table_name="environment_builds"
    )
    op.drop_index("ix_environment_builds_project_path", table_name="environment_builds")
    op.drop_index("ix_environment_builds_project_uuid", table_name="environment_builds")
    op.drop_index("uuid_proj_env_index", table_name="environment_builds")
    op.drop_table("environment_builds")
    op.create_table(
        "environments",
        sa.Column("project_uuid", sa.String(length=36), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_uuid"],
            ["projects.uuid"],
            name=op.f("fk_environments_project_uuid_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("project_uuid", "uuid", name=op.f("pk_environments")),
    )
    op.create_table(
        "environment_images",
        sa.Column("project_uuid", sa.String(length=36), nullable=False),
        sa.Column("environment_uuid", sa.String(length=36), nullable=False),
        sa.Column("tag", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_uuid", "environment_uuid"],
            ["environments.project_uuid", "environments.uuid"],
            name=op.f(
                "fk_environment_images_project_uuid_environment_uuid_environments"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "project_uuid",
            "environment_uuid",
            "tag",
            name=op.f("pk_environment_images"),
        ),
    )
    op.create_table(
        "environment_image_builds",
        sa.Column("project_uuid", sa.String(length=36), nullable=False),
        sa.Column("environment_uuid", sa.String(length=36), nullable=False),
        sa.Column("image_tag", sa.Integer(), nullable=False),
        sa.Column("project_path", sa.String(length=4096), nullable=False),
        sa.Column("requested_time", sa.DateTime(), nullable=False),
        sa.Column("started_time", sa.DateTime(), nullable=True),
        sa.Column("finished_time", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(length=15), nullable=True),
        sa.ForeignKeyConstraint(
            ["project_uuid", "environment_uuid", "image_tag"],
            [
                "environment_images.project_uuid",
                "environment_images.environment_uuid",
                "environment_images.tag",
            ],
            name=op.f(
                "fk_environment_image_builds_project_uuid_environment_uuid_image_"
                "tag_environment_images"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "project_uuid",
            "environment_uuid",
            "image_tag",
            name=op.f("pk_environment_image_builds"),
        ),
    )
    op.create_index(
        op.f("ix_environment_image_builds_environment_uuid"),
        "environment_image_builds",
        ["environment_uuid"],
        unique=False,
    )
    op.create_index(
        op.f("ix_environment_image_builds_image_tag"),
        "environment_image_builds",
        ["image_tag"],
        unique=False,
    )
    op.create_index(
        op.f("ix_environment_image_builds_project_path"),
        "environment_image_builds",
        ["project_path"],
        unique=False,
    )
    op.create_index(
        op.f("ix_environment_image_builds_project_uuid"),
        "environment_image_builds",
        ["project_uuid"],
        unique=False,
    )
    op.create_index(
        "uuid_proj_env_index",
        "environment_image_builds",
        ["project_uuid", "environment_uuid"],
        unique=False,
    )


def downgrade():
    op.drop_index("uuid_proj_env_index", table_name="environment_image_builds")
    op.drop_index(
        op.f("ix_environment_image_builds_project_uuid"),
        table_name="environment_image_builds",
    )
    op.drop_index(
        op.f("ix_environment_image_builds_project_path"),
        table_name="environment_image_builds",
    )
    op.drop_index(
        op.f("ix_environment_image_builds_image_tag"),
        table_name="environment_image_builds",
    )
    op.drop_index(
        op.f("ix_environment_image_builds_environment_uuid"),
        table_name="environment_image_builds",
    )
    op.drop_table("environment_image_builds")
    op.drop_table("environment_images")
    op.drop_table("environments")
    op.create_table(
        "environment_builds",
        sa.Column("uuid", sa.VARCHAR(length=36), autoincrement=False, nullable=False),
        sa.Column(
            "project_uuid", sa.VARCHAR(length=36), autoincrement=False, nullable=False
        ),
        sa.Column(
            "environment_uuid",
            sa.VARCHAR(length=36),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "project_path", sa.VARCHAR(length=4096), autoincrement=False, nullable=False
        ),
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
        sa.ForeignKeyConstraint(
            ["project_uuid"],
            ["projects.uuid"],
            name="fk_environment_builds_project_uuid_projects",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("uuid", name="pk_environment_builds"),
    )
    op.create_index(
        "uuid_proj_env_index",
        "environment_builds",
        ["project_uuid", "environment_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_environment_builds_project_uuid",
        "environment_builds",
        ["project_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_environment_builds_project_path",
        "environment_builds",
        ["project_path"],
        unique=False,
    )
    op.create_index(
        "ix_environment_builds_environment_uuid",
        "environment_builds",
        ["environment_uuid"],
        unique=False,
    )
