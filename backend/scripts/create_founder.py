"""Разовый скрипт создания первого Founder-аккаунта после деплоя (тут нет seed-миграции —
Users заполняется только через интерфейс, а на чистой БД интерфейсом некому зайти).

Запуск на проде (Render shell / `railway run` и т.п.):
    python -m scripts.create_founder --fio "Любовь Лаврухина" --login founder --password ...
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import bcrypt
from sqlalchemy import select

from app.constants import FOUNDER, USER_STATUS_ACTIVE
from app.db import SessionLocal
from app.models import User


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fio", required=True)
    parser.add_argument("--login", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if db.scalar(select(User).where(User.login.ilike(args.login.strip()))):
            print(f"Логин '{args.login}' уже занят.", file=sys.stderr)
            raise SystemExit(1)

        user = User(
            fio=args.fio.strip(),
            login=args.login.strip(),
            password_hash=bcrypt.hashpw(args.password.encode("utf-8"), bcrypt.gensalt()).decode(),
            role=FOUNDER,
            status=USER_STATUS_ACTIVE,
        )
        db.add(user)
        db.commit()
        print(f"Founder создан: {user.fio} ({user.login}), id={user.id}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
