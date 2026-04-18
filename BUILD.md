# Сборка под платформы

Все сборки идут **только в GitHub Actions**, чтобы в репозитории не появлялось файлов >100MB (Android SDK, Xcode build, Rust target и т.д.).

## Что в репо
- `capacitor.config.ts` — конфиг Capacitor (мобилки)
- `src-tauri/` — конфиг Tauri (Windows). Папки `target/` и `gen/` игнорятся.
- `.github/workflows/` — три workflow: Android / iOS / Windows

## Чего НЕТ в репо (генерируется в CI)
- `android/` и `ios/` — создаются через `npx cap add` прямо в workflow
- `src-tauri/target/` — Rust артефакты сборки
- `node_modules/`, `dist/`

## Как запустить сборку
1. Подключи проект к GitHub (Lovable → Connectors → GitHub).
2. Запушь тег: `git tag v0.1.0 && git push --tags`
3. В GitHub → Actions запустятся 3 джобы. Артефакты (`.apk`, `.app`, `.msi`, `.exe`) будут в Actions → конкретный run → Artifacts.

Можно также вручную: Actions → выбрать workflow → **Run workflow**.

## Подписание (опционально)
- **Android релиз в Play Store**: добавить keystore в GitHub Secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`) и доработать `build-android.yml` для подписи.
- **iOS в App Store**: нужен Apple Developer ($99/год). Сейчас собирается unsigned `.app` для тестов через AltStore/Sideloadly.
- **Windows**: можно добавить code signing certificate, но не обязательно.

## Локальная разработка (если хочешь)
Требует git pull проекта себе:
```bash
npm install
npm run build
# Android (нужен Android Studio):
npx cap add android && npx cap sync && npx cap run android
# iOS (нужен Mac + Xcode):
npx cap add ios && npx cap sync && npx cap run ios
# Windows (нужен Rust):
npx tauri dev
```

## Важно про размер файлов
Если случайно закоммитишь `android/`, `ios/`, `src-tauri/target/` — будут файлы >100MB и GitHub отклонит push. Эти папки уже в `.gitignore` (см. `src-tauri/.gitignore` и нужно добавить в корневой `.gitignore` строки):
```
android/
ios/
node_modules/
dist/
*.apk
*.ipa
*.msi
```
