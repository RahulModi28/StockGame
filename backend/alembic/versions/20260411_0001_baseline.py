"""baseline schema marker

Revision ID: 20260411_0001
Revises:
Create Date: 2026-04-11 00:00:00.000000
"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "20260411_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Baseline marker for existing deployments.
    pass


def downgrade() -> None:
    pass
