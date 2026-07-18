"""Разовый скрипт создания первого Founder-аккаунта после деплоя (тут нет seed-миграции —
Users заполняется только через интерфейс, а на чистой БД интерфейсом некому зайти).

По умолчанию создаёт НОВУЮ компанию (мультитенантность, см. CLAUDE.md) — используется
для онбординга нового клиента. --company-id вместо --company-name прикрепляет Founder-
аккаунт к уже существующей компании (например, второй Founder той же мастерской).

Мульти-компанийные пользователи (2026-07-18): если --login уже существует у другого
человека — не ошибка, а привязка ЭТОГО существующего аккаунта к компании с ролью FOUNDER
(см. `attach_or_create_membership` в app/security.py — требует правильный --password
существующего аккаунта, иначе кто угодно с доступом к этому скрипту мог бы захватить
чужой аккаунт зная только логин; --fio тогда игнорируется). Тот же helper, что в
app/routers/companies.py и users.py — не три копии одной логики.

Запуск на проде (Render shell / `railway run` и т.п.):
    python -m scripts.create_founder --company-name "oinarri" --fio "Любовь Лаврухина" \
        --login founder --password ...
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException

from app.constants import FOUNDER
from app.db import SessionLocal
from app.models import Company
from app.security import attach_or_create_membership


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
        if args.company_id:
            company = db.get(Company, args.company_id)
            if company is None:
                print(f"Компания с id '{args.company_id}' не найдена.", file=sys.stderr)
                raise SystemExit(1)
        else:
            company = Company(name=args.company_name.strip())
            db.add(company)
            db.flush()

        try:
            user, attached_existing = attach_or_create_membership(
                db, login=args.login, company_id=company.id, role=FOUNDER, password=args.password, fio=args.fio
            )
        except HTTPException as e:
            print(f"Ошибка: {e.detail}", file=sys.stderr)
            raise SystemExit(1)

        print(f"Компания: {company.name} (id={company.id})")
        if attached_existing:
            print(f"Существующий аккаунт '{user.login}' привязан как Founder, id={user.id}")
        else:
            print(f"Founder создан: {user.fio} ({user.login}), id={user.id}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
