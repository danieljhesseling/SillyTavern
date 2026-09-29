---
title: El servidor privado — abrir el juego a tus amigos
tags: [servidor, amigos, red, seguridad, arranque, J0.9]
created: 2026-09-29
updated: 2026-09-29
author: DanielJHesseling / Claude Opus 5.5
---

# 🔐 Abrir el juego a tus amigos

> [!NOTE]
> **Qué es esto.** Cómo dejar que tus amigos entren en tu juego desde su ordenador o su móvil, en tu casa o desde fuera, **con contraseña**. Es J0.9 de [[ROADMAP_SIN_CONEXION]].
>
> **Todo se cambia en un solo archivo**: `config.yaml`, en la carpeta del juego (`C:\Users\danie\SillyTavern`). Se abre con el Bloc de notas. Después de cambiarlo, cierra la ventana negra del servidor y vuelve a abrir `Jugar.bat`: el servidor solo lee el archivo al arrancar.

---

## 1. Arrancar con un doble clic

- **Windows:** doble clic en `Jugar.bat`.
- **Linux o Mac:** `./jugar.sh` (o doble clic, si tu escritorio lo permite).

Si el servidor está apagado, lo enciende (instala lo que falte, como `Start.bat`) y abre el navegador cuando está listo. Si ya estaba encendido, solo abre el navegador. El juego sale directo en su portada.

La ventana negra **es** el servidor: mientras esté abierta, se puede jugar. Al cerrarla, se para.

---

## 2. Las claves de `config.yaml`

| Clave | Qué hace | Lo normal | Para tus amigos |
| :--- | :--- | :--- | :--- |
| `listen` | Si otros aparatos pueden entrar | `false`: solo tu ordenador | `true` |
| `whitelistMode` | Si solo entran las direcciones de la lista | `true` | `true` en casa; `false` desde fuera |
| `whitelist` | La lista de direcciones que pueden entrar | la tuya (`127.0.0.1` y `::1`) | añade tu red de casa |
| `basicAuthMode` | Si pide usuario y contraseña | `false` | **`true`, siempre** |
| `basicAuthUser` | El usuario (`username`) y la contraseña (`password`) | `user` y `password` | los vuestros |
| `port` | El puerto: el número que va tras los dos puntos en la dirección | `8000` | `8000` vale |

Dos cosas que conviene saber:
- **La contraseña solo se pide con `listen: true`.** Con `listen: false` nadie de fuera puede entrar, así que no hace falta.
- **Con `listen: true`, el servidor no arranca** si no hay lista (`whitelistMode`) ni contraseña (`basicAuthMode`). Lo hace a propósito: no lo fuerces.

---

## 3. En tu casa, con la misma wifi

**Paso 1: la dirección de tu ordenador en casa.** Pulsa la tecla de Windows, escribe `cmd` y abre el *Símbolo del sistema*. Escribe `ipconfig` y pulsa Intro. Busca tu wifi (o tu cable) y la línea **Dirección IPv4**: algo como `192.168.1.35`. Esa es tu dirección en casa.

**Paso 2: `config.yaml`.** Cambia estas líneas (las demás, como estén). Pon **tus** tres primeros números en la lista: si tu dirección es `192.168.1.35`, tu red es `192.168.1.0/24`, que quiere decir «cualquier aparato de casa que empiece por `192.168.1.`».

```yaml
listen: true
whitelistMode: true
whitelist:
  - ::1
  - 127.0.0.1
  - 192.168.1.0/24
basicAuthMode: true
basicAuthUser:
  username: "gremio"
  password: "una frase larga que solo sepáis vosotros"
port: 8000
```

**Paso 3: el aviso de Windows.** La primera vez que arranques así, Windows pregunta si deja a *Node.js* comunicarse en la red. Marca **Redes privadas** y **no** marques *Redes públicas*. Luego pulsa *Permitir*.
- Si le diste a *Cancelar*: menú Inicio, escribe *Permitir una aplicación a través del Firewall de Windows*, busca *Node.js* y marca **Privada**.
- Y tu wifi tiene que ser una red privada: *Configuración → Red e Internet → Wi-Fi →* tu red *→ Tipo de perfil de red: Privada*. Si es pública, Windows no deja entrar a nadie.

**Paso 4: tus amigos.** En su navegador escriben `http://192.168.1.35:8000` (tu dirección y tu puerto). Les pide el usuario y la contraseña, y entran en la portada del juego. **A ti también te la pide**, una vez por sesión.

### Desde el móvil, en la misma wifi

Lo mismo: en el navegador del móvil, `http://192.168.1.35:8000`, usuario y contraseña. El móvil está en tu red de casa, así que la lista ya lo deja pasar.

Hoy el juego **funciona pero no está hecho para el móvil**: la pantalla es de ordenador y el tablero va con ratón. Jugar bien desde el teléfono es la fase **J20** de [[ROADMAP_SIN_CONEXION]] (J20.8 retomará esta guía con el paso del móvil).

---

## 4. Desde fuera de casa

Fuera de casa la dirección de tus amigos cambia cada día, así que la lista no sirve: **la contraseña es la única puerta**.

```yaml
listen: true
whitelistMode: false
basicAuthMode: true
basicAuthUser:
  username: "gremio"
  password: "una frase larga que solo sepáis vosotros"
```

Y para que te lleguen desde internet, lo más sencillo es **`Remote-Link.cmd`**, que está en la carpeta del juego: abre un túnel de Cloudflare y te da una dirección temporal que empieza por `https://`. Se la pasas a tus amigos, y al cerrar su ventana el túnel se cierra.
- Usa el puerto `8000`: el túnel apunta ahí.
- **Con el túnel, `listen: true` también.** Si no, la contraseña no se pide y cualquiera con la dirección entra.

La otra forma es abrir el puerto en el router de casa, pero no la recomiendo: deja tu ordenador a la vista de todo internet, sin cifrar, todo el tiempo.

---

## 5. Lo que hay que saber antes de abrirlo

- **Quien entra puede hacer lo mismo que tú.** Ve y borra tus partidas y tus personajes. Si algún día pones claves de una IA, las puede gastar. Dáselo solo a gente de confianza.
- **Cambia `user` y `password`.** Son los de ejemplo, y los conoce cualquiera. Una frase larga es mejor que una palabra rara.
- **En casa, la contraseña viaja sin cifrar** (la dirección empieza por `http://`, no `https://`). En tu wifi vale; en una wifi pública o de otros, no.
- **Todos jugáis en tus datos.** Hoy el juego es de un jugador: jugar juntos en la misma partida (J6) está aparcado. Cada amigo puede empezar su propia partida desde «Jugar sin conexión», pero **no juguéis dos a la vez en la misma**: uno pisaría lo que guarda el otro. (Hay una clave, `enableUserAccounts`, que da a cada uno su usuario y sus partidas aparte, pero enseña pantallas de SillyTavern: no está pensada para el juego todavía.)
- **Al acabar, ciérralo.** Cierra el túnel o vuelve a `listen: false`. Un servidor abierto sin nadie jugando es una puerta abierta.
- **Si alguien falla la contraseña cinco veces** en un minuto, el servidor le hace esperar un minuto. Es normal.
