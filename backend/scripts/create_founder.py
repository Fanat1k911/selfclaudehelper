"""Разовый скрипт создания первого Founder-аккаунта после деплоя (тут нет seed-миграции —
Users заполняется только через интерфейс, а на чистой БД интерфейсом некому зайти).

По умолчанию создаёт НОВУЮ компанию (мультитенантность, см. CLAUDE.md) — используется
для онбординга нового клиента. --company-id вместо --company-name прикрепляет Founder-
аккаунт к уже существующей компании (например, второй Founder той же мастерской).

Запуск на проде (Render shell / `railway run` и т.п.):
    python -m scripts.create_founder --company-name "oinarri" --fio "Любовь Лаврухина" \
        --login founder --password ...
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import bcrypt
from sqlalchemy import select

from app.constants import FOUNDER, USER_STATUS_ACTIVE
from app.db import SessionLocal
from app.models import Company, User


def main() -> None:
    parser = argparse.ArgumentParser()
    company_group = parser.add_mutually_exclusive_group(required=True)
    company_group.add_argument("--company-name", help="Создать новую компанию с этим названием.")
    company_group.add_argument("--company-id", help="Прикрепить к уже существующей компании по id.")
    parser.add_argument("--fio", required=True)
    parser.add_argument("--login", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if db.scalar(select(User).where(User.login.ilike(args.login.strip()))):
            print(f"Логин '{args.login}' уже занят.", file=sys.stderr)
            raise SystemExit(1)

        if args.company_id:
            company = db.get(Company, args.company_id)
            if company is None:
                print(f"Компания с id '{args.company_id}' не найдена.", file=sys.stderr)
                raise SystemExit(1)
        else:
            company = Company(name=args.company_name.strip())
            db.add(company)
            db.flush()

        user = User(
            company_id=company.id,
            fio=args.fio.strip(),
            login=args.login.strip(),
            password_hash=bcrypt.hashpw(args.password.encode("utf-8"), bcrypt.gensalt()).decode(),
            role=FOUNDER,
            status=USER_STATUS_ACTIVE,
        )
        db.add(user)
        db.commit()
        print(f"Компания: {company.name} (id={company.id})")
        print(f"Founder создан: {user.fio} ({user.login}), id={user.id}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
