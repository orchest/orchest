"""Create projects, pipelines tables. Setup environment_variables.

Revision ID: 7898eecfbe51
Revises: 9bc7c3a744a3
Create Date: 2021-02-03 10:55:24.745431

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "7898eecfbe51"
down_revision = "9bc7c3a744a3"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "projects",
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "env_variables",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("uuid", name=op.f("pk_projects")),
    )

    op.create_table(
        "pipelines",
        sa.Column("project_uuid", sa.String(length=36), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "env_variables",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["project_uuid"],
            ["projects.uuid"],
            name=op.f("fk_pipelines_project_uuid_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("project_uuid", "uuid", name=op.f("pk_pipelines")),
    )

    # Job.project_uuid and Job.pipeline_uuid were previously nullable,
    # now they aren't anymore.
    op.execute(
        """
    DELETE FROM jobs where project_uuid is NULL or pipeline_uuid is NULL;
    """
    )

    # PipelineRun.project_uuid was previously nullable, now it is not
    # anymore.
    op.execute(
        """
    DELETE FROM pipeline_runs where project_uuid is NULL;
    """
    )

    # This way pre-existing entities are not invalidated by the fact
    # that the projects and pipelines tables are freshly created and FKs
    # are not there.
    op.execute(
        """
        INSERT INTO projects
        SELECT * FROM
        (
        SELECT project_uuid  FROM environment_builds
        UNION
        SELECT  project_uuid FROM interactive_sessions
        UNION
        SELECT project_uuid FROM jobs
        UNION
        SELECT project_uuid FROM pipeline_runs
        ) pu;
        """
    )

    op.execute(
        """
        INSERT INTO pipelines (project_uuid, uuid)
        SELECT * FROM
        (
        SELECT  project_uuid, pipeline_uuid FROM interactive_sessions
        UNION
        SELECT project_uuid, pipeline_uuid  FROM jobs
        UNION
        SELECT project_uuid, pipeline_uuid FROM pipeline_runs
        ) ppu;
        """
    )

    # EnvironmentBuild.
    op.create_foreign_key(
        op.f("fk_environment_builds_project_uuid_projects"),
        "environment_builds",
        "projects",
        ["project_uuid"],
        ["uuid"],
        ondelete="CASCADE",
    )

    # InteractiveSession.
    op.create_index(
        op.f("ix_interactive_sessions_pipeline_uuid"),
        "interactive_sessions",
        ["pipeline_uuid"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interactive_sessions_project_uuid"),
        "interactive_sessions",
        ["project_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_interactive_sessions_project_uuid_pipeline_uuid",
        "interactive_sessions",
        ["project_uuid", "pipeline_uuid"],
        unique=False,
    )
    op.create_foreign_key(
        op.f("fk_interactive_sessions_project_uuid_projects"),
        "interactive_sessions",
        "projects",
        ["project_uuid"],
        ["uuid"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        op.f("fk_interactive_sessions_project_uuid_pipeline_uuid_pipelines"),
        "interactive_sessions",
        "pipelines",
        ["project_uuid", "pipeline_uuid"],
        ["project_uuid", "uuid"],
    )

    # Job.
    op.add_column(
        "jobs",
        sa.Column(
            "env_variables",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
    )
    op.alter_column(
        "jobs", "pipeline_uuid", existing_type=sa.VARCHAR(length=36), nullable=False
    )
    op.alter_column(
        "jobs", "project_uuid", existing_type=sa.VARCHAR(length=36), nullable=False
    )
    op.create_index(
        op.f("ix_jobs_pipeline_uuid"), "jobs", ["pipeline_uuid"], unique=False
    )
    op.create_index(
        op.f("ix_jobs_project_uuid"), "jobs", ["project_uuid"], unique=False
    )
    op.create_index(
        "ix_jobs_project_uuid_pipeline_uuid",
        "jobs",
        ["project_uuid", "pipeline_uuid"],
        unique=False,
    )
    op.create_foreign_key(
        op.f("fk_jobs_project_uuid_projects"),
        "jobs",
        "projects",
        ["project_uuid"],
        ["uuid"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        op.f("fk_jobs_project_uuid_pipeline_uuid_pipelines"),
        "jobs",
        "pipelines",
        ["project_uuid", "pipeline_uuid"],
        ["project_uuid", "uuid"],
    )

    # PipelineRun.
    op.add_column(
        "pipeline_runs",
        sa.Column(
            "env_variables",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
    )
    op.alter_column(
        "pipeline_runs",
        "project_uuid",
        existing_type=sa.VARCHAR(length=36),
        nullable=False,
    )
    op.create_index(
        op.f("ix_pipeline_runs_pipeline_uuid"),
        "pipeline_runs",
        ["pipeline_uuid"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pipeline_runs_project_uuid"),
        "pipeline_runs",
        ["project_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_pipeline_runs_project_uuid_pipeline_uuid",
        "pipeline_runs",
        ["project_uuid", "pipeline_uuid"],
        unique=False,
    )
    op.create_foreign_key(
        op.f("fk_pipeline_runs_project_uuid_pipeline_uuid_pipelines"),
        "pipeline_runs",
        "pipelines",
        ["project_uuid", "pipeline_uuid"],
        ["project_uuid", "uuid"],
    )
    op.create_foreign_key(
        op.f("fk_pipeline_runs_project_uuid_projects"),
        "pipeline_runs",
        "projects",
        ["project_uuid"],
        ["uuid"],
        ondelete="CASCADE",
    )


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(
        op.f("fk_pipeline_runs_project_uuid_projects"),
        "pipeline_runs",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_pipeline_runs_project_uuid_pipeline_uuid_pipelines"),
        "pipeline_runs",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_pipeline_runs_project_uuid_pipeline_uuid", table_name="pipeline_runs"
    )
    op.drop_index(op.f("ix_pipeline_runs_project_uuid"), table_name="pipeline_runs")
    op.drop_index(op.f("ix_pipeline_runs_pipeline_uuid"), table_name="pipeline_runs")
    op.alter_column(
        "pipeline_runs",
        "project_uuid",
        existing_type=sa.VARCHAR(length=36),
        nullable=True,
    )
    op.drop_column("pipeline_runs", "env_variables")
    op.drop_constraint(
        op.f("fk_jobs_project_uuid_pipeline_uuid_pipelines"), "jobs", type_="foreignkey"
    )
    op.drop_constraint(
        op.f("fk_jobs_project_uuid_projects"), "jobs", type_="foreignkey"
    )
    op.drop_index("ix_jobs_project_uuid_pipeline_uuid", table_name="jobs")
    op.drop_index(op.f("ix_jobs_project_uuid"), table_name="jobs")
    op.drop_index(op.f("ix_jobs_pipeline_uuid"), table_name="jobs")
    op.alter_column(
        "jobs", "project_uuid", existing_type=sa.VARCHAR(length=36), nullable=True
    )
    op.alter_column(
        "jobs", "pipeline_uuid", existing_type=sa.VARCHAR(length=36), nullable=True
    )
    op.drop_column("jobs", "env_variables")
    op.drop_constraint(
        op.f("fk_interactive_sessions_project_uuid_pipeline_uuid_pipelines"),
        "interactive_sessions",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_interactive_sessions_project_uuid_projects"),
        "interactive_sessions",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_interactive_sessions_project_uuid_pipeline_uuid",
        table_name="interactive_sessions",
    )
    op.drop_index(
        op.f("ix_interactive_sessions_project_uuid"), table_name="interactive_sessions"
    )
    op.drop_index(
        op.f("ix_interactive_sessions_pipeline_uuid"), table_name="interactive_sessions"
    )
    op.drop_constraint(
        op.f("fk_environment_builds_project_uuid_projects"),
        "environment_builds",
        type_="foreignkey",
    )
    op.drop_table("pipelines")
    op.drop_table("projects")
    # ### end Alembic commands ###
