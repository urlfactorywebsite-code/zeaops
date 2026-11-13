"""Create only the control-plane bootstrap metadata table."""

import sqlalchemy as sa
from alembic import op

revision = "0001_bootstrap"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bootstrap_metadata",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("component", sa.String(64), nullable=False, unique=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )


def downgrade() -> None:
    op.drop_table("bootstrap_metadata")
