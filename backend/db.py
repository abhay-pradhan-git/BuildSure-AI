"""
Database engine + session dependency for FastAPI.
Set DATABASE_URL in the environment, e.g.:
  postgresql+psycopg://user:password@localhost:5432/buildsure
"""
import os
from typing import Generator

from sqlmodel import Session, SQLModel, create_engine

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+psycopg://buildsure:buildsure@localhost:5432/buildsure"
)

engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)


def init_db() -> None:
    """Create tables from SQLModel metadata (dev convenience; use schema.sql/Alembic in prod)."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
