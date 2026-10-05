---
title: Tutorial — Montar e instalar la APK de Dnd Master en Android
tags: [tutorial, android, apk, movil, sin-servidor, sin-conexion, indexeddb]
created: 2026-10-05
---

# 📱 Dnd Master en Android: Montar e Instalar la APK

Con **`MontarAPK.exe`** (o `CrearAPK.exe`), empaquetas todo el juego en un archivo **`Dnd-Master.apk`** e instalas la app en tu teléfono con **un solo doble clic**.

Juegas en cualquier parte: **sin encender el PC, sin servidor Node.js, sin internet y en modo avión**. El juego es tuyo, el repositorio sigue privado y no hay que publicar nada en internet ni en la Play Store.

Vuelve a [[Tutoriales]] · Roadmap técnico completo: [[ROADMAP_APK_ANDROID]].

---

## 1. Cómo funciona por dentro: El «Servidor de Bolsillo»

En el PC, el navegador habla con `server.js` y guarda las partidas en `data/default-user/`.

En la APK de Android:
1. **Los archivos del juego** van dentro de la APK empaquetados en un WebView nativo de alto rendimiento.
2. **El Servidor de Bolsillo** (`public/scripts/sin-servidor/`): un interceptor ultraligero que atiende las llamadas que antes iban a `server.js` (`/api/chats`, `/api/worldinfo`, `/api/characters`, `/api/files`, etc.).
3. **El Disco de Mentira**: guarda todas tus partidas, chats, héroes creados, mundos y ajustes directamente en la memoria local del teléfono con **IndexedDB** (base de datos `dndcoin`).
4. **Cero consumo innecesario**: se apagan las llamadas a modelos externos de IA, tokenizadores pesados y extensiones no utilizadas, por lo que el juego arranca de inmediato y consume un mínimo de batería.

---

## 2. Montar la APK con `MontarAPK.exe`

En la carpeta principal del juego (`C:\Users\danie\SillyTavern`):

1. Haz **doble clic en `MontarAPK.exe`** (o `CrearAPK.exe`).
2. Se abrirá la ventana del taller de montaje con estética dark fantasy:
   - **Diagnóstico del sistema**: comprueba automáticamente Node.js, el JDK de Java, el Android SDK y si hay algún teléfono enchufado por USB.
   - **Botón «Montar APK Ahora»**: pulsa este botón.
3. El taller realizará automáticamente los 4 pasos:
   - 📦 Prepara la copia ligera del juego excluyendo extensiones y pesos muertos (~30–40 MB).
   - ⚙️ Empaqueta las librerías (`lib.js`) y el cargador offline.
   - 🔨 Compila la APK nativa con Gradle.
   - ✨ Deja la APK lista en `app-android/salida/Dnd-Master.apk` y en `salida/Dnd-Master.apk`.

> [!TIP]
> También puedes montar la APK directamente desde la consola con:
> ```powershell
> node tools\apk.mjs
> ```

---

## 3. Instalar en tu móvil

Hay dos formas muy sencillas de poner la app en tu teléfono:

### Opción A: Por cable USB (1 solo clic, la más rápida)

1. En tu móvil Android:
   - Abre **Ajustes** → **Acerca del teléfono**.
   - Toca 7 veces seguidas en **Número de compilación** hasta que diga *«¡Ya eres desarrollador!»*.
   - Ve a **Ajustes** → **Sistema / Opciones de desarrollador** y activa **Depuración por USB**.
2. Conecta el móvil al PC con el cable USB y acepta el mensaje que aparece en la pantalla del móvil (*«¿Permitir depuración por USB desde este ordenador?»*).
3. En la ventana de `MontarAPK.exe`, verás que el indicador USB se pone en verde con el identificador de tu teléfono.
4. Pulsa el botón **«📲 Instalar en el móvil por USB»** (o ejecuta `node tools\apk.mjs --instalar`).
5. En unos segundos, el icono de **Dnd Master** (el escudo con la espada) aparecerá en el menú de aplicaciones de tu móvil.

### Opción B: Pasando el archivo APK

1. Pulsa el botón **«📂 Abrir carpeta de la APK»** en la ventana (o abre `app-android\salida\`).
2. Cópiale el archivo `Dnd-Master.apk` a tu móvil (enviándotelo por Telegram, WhatsApp, Google Drive o cable).
3. En el móvil, abre el archivo y dale a **Instalar**.
   - Si Android te avisa de *«Instalar aplicaciones de fuentes desconocidas»*, dale permiso al explorador de archivos.
   - Si Google Play Protect muestra una advertencia porque la app está hecha por ti en tu PC y no en su tienda, pulsa **Más detalles** → **Instalar de todas formas**.

---

## 4. Probar sin servidor en el PC

Si quieres probar cómo funciona el juego offline con el servidor de bolsillo antes de pasarlo al móvil:

```powershell
node tools\apk.mjs --copiar
```
Y abre `app-android\www\index.html` en tu navegador o mediante el botón **«Probar juego sin servidor en el PC»**. El juego utilizará el IndexedDB del navegador de la misma forma exacta que en el teléfono.

---

## 5. Actualizaciones y tus partidas guardadas

- **Actualizar la app no borra tus partidas**: cuando montes una nueva versión y la instales encima, Android mantiene tus partidas guardadas en el almacén interno.
- **Exportar e importar partidas**: desde el menú de pausa de Dnd Master puedes pulsar **«Exportar partida»** para obtener un archivo `.partida.json` que puedes guardar en Drive o pasar al PC y viceversa.
