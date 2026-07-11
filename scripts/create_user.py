"""
Генератор bcrypt-хэша для ручного добавления строки в лист Users
(файл "Мыловарня: Доступы"). Сам скрипт в Google Sheets ничего не пишет —
он не имеет доступа к твоим credentials на этом этапе, это осознанно.

Запуск: python scripts/create_user.py
"""

import getpass
import uuid

import bcrypt


def main() -> None:
    password = getpass.getpass("Пароль: ")
    confirm = getpass.getpass("Повтори пароль: ")
    if password != confirm:
        print("Пароли не совпадают.")
        return

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    print("\nСтрока для листа Users (файл 'Мыловарня: Доступы'):")
    print(f"id: {uuid.uuid4().hex[:8]}")
    print("ФИО: <Лаврухина Любовь Юрьевна>")
    print("логин: <loveelavr>")
    print(f"хэш пароля: {hashed}")
    print("роль: founder")
    print("статус: активен")


if __name__ == "__main__":
    main()
