# Pixel Budget Planner — web

Веб-версия C++ приложения: GitHub Pages размещает интерфейс, Firebase Auth + Firestore синхронизируют операции и лимиты между телефоном и ноутбуком.

## 1. Firebase — один раз

1. Открой [Firebase Console](https://console.firebase.google.com/) и создай проект.
2. **Authentication → Sign-in method**: включи **Google**.
3. **Firestore Database → Create database**: выбери production mode и регион поближе к себе.
4. В **Project settings → Your apps → Web app** зарегистрируй веб-приложение и скопируй объект `firebaseConfig` в `firebase-config.js` вместо `null`.
5. В **Authentication → Settings → Authorized domains** добавь `<твой-логин>.github.io` после публикации.
6. В Firestore Rules вставь правила из `firestore.rules` и опубликуй их.

## 2. GitHub Pages

1. Создай на GitHub новый **public** репозиторий, например `pixel-budget`.
2. Загрузи содержимое именно этой папки `web/` в корень репозитория.
3. В репозитории: **Settings → Pages → Build and deployment → GitHub Actions**.
4. Сделай первый commit в ветку `main`; workflow `Deploy GitHub Pages` опубликует сайт по адресу `https://<логин>.github.io/pixel-budget/`.

Не добавляй в репозитор пароли, ключи сервисных аккаунтов или банковские данные. Firebase Web Config можно хранить в коде: защита данных задаётся Firestore Rules и входом пользователя.
