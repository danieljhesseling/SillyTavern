---
title: Mapa Completo del Código & Estructura de Archivos
tags: [codigo, estructura, mapa, directorios, backend, frontend, fork, dnd]
created: 2026-09-20
author: DanielJHesseling / Antigravity AI
---

# Mapa Completo del Código & Estructura de Archivos

Este documento sirve como inventario exhaustivo del repositorio, clasificando los archivos y carpetas clave entre los componentes base de SillyTavern y las extensiones introducidas en el fork de DanielJHesseling.

---

## 1. Directorios Principales del Repositorio

| Directorio | Propósito & Contenido | Origen |
| :--- | :--- | :--- |
| `src/` | Código fuente del servidor Node.js (Express, routers, middleware, utilidades). | SillyTavern Core |
| `src/endpoints/` | Más de 40 routers REST modulares para personajes, chats, IA y configuración. | SillyTavern Core |
| `src/middleware/` | Filtros HTTP: protección CSRF, whitelist de IP, host headers, auth. | SillyTavern Core |
| `src/vectors/` | Motor RAG vectorial local basado en Vectra y transformers.js. | SillyTavern Core |
| `src/png/` | Extractor e inyector de metadatos en chunks tEXt/iTXt de imágenes PNG. | SillyTavern Core |
| `public/` | Código fuente del cliente web servido al navegador (HTML, CSS, JS, libs). | SillyTavern Core + Fork |
| `public/scripts/` | Módulos ES de lógica de frontend (más de 80 archivos). | SillyTavern Core + Fork |
| `public/css/` | Hojas de estilo CSS del cliente. | SillyTavern Core + Fork |
| `public/lib/` | Bibliotecas de terceros (jQuery, jQuery UI, Select2, Toastr, etc.). | SillyTavern Core |
| `data/` | Directorio de almacenamiento de datos persistentes por usuario. | Generado en runtime |
| `default/` | Plantillas de configuración y assets por defecto (`config.yaml`). | SillyTavern Core |
| `plugins/` | Directorio para plugins de servidor adicionales en Node.js. | SillyTavern Core |
| `tests/` | Suite de pruebas automatizadas (Jest y Playwright). | SillyTavern Core |
| `docker/` | Archivos de configuración para despliegues con Docker y Docker Compose. | SillyTavern Core |
| `wiki/` | Esta base de conocimiento para Obsidian y agentes de IA. | Documentación |

---

## 2. Inventario de Archivos Clave del Motor RPG (Fork `my-silly`)

Los siguientes archivos fueron creados o modificados sustancialmente por DanielJHesseling para incorporar las mecánicas de juego de rol:

| Archivo | Líneas / Tamaño | Función Principal |
| :--- | :--- | :--- |
| `public/scripts/party.js` | 4,734 líneas (209 KB) | Gestor de grupo RPG, ficha D&D, líder de chat, HP en tiempo real, leveling y dados. |
| `public/scripts/dynamic-context-manager.js` | 1,919 líneas (83 KB) | Máquina de estados de campaña, presupuesto de tokens y filtrado de instrucciones. |
| `public/scripts/dnd-system.js` | 1,327 líneas (53 KB) | Fórmulas D&D 5e, slots de equipo, armas, armaduras, afinidades y memorias. |
| `public/scripts/world-content-popups.js` | 1,109 líneas (62 KB) | Formularios modales enriquecidos para monstruos, hechizos, ítems y facciones. |
| `public/scripts/world-map-renderer.js` | 927 líneas (37 KB) | Motor zoomable de mapas continentales, planos de localización y tableros tácticos. |
| `public/scripts/world-content-browser.js` | 684 líneas (28 KB) | Navegador visual de cuadrícula para entidades del Lorebook por categorías. |
| `public/scripts/chat-enhancements.js` | 663 líneas (23 KB) | Subrayado de términos de Lorebook con tooltips y avatares de diálogo en línea. |
| `public/scripts/campaigns.js` | 656 líneas (27 KB) | Tarjetas de campaña en pantalla de bienvenida, agrupadas por mundo. |
| `public/scripts/active-instructions.js` | 286 líneas (11 KB) | Administrador de instrucciones de usuario inyectadas en el prompt. |
| `public/scripts/world-info.js` | Modificado (+1,300 lín.) | Exportación de mapas, tableros, monstruos y esquema `dndData`. |
| `public/scripts/personas.js` | Modificado (+167 lín.) | Incorporación de estadísticas D&D en los descriptores de persona del usuario. |
| `public/script.js` | Modificado (+219 lín.) | Arranque de subsistemas RPG e inyección de fichas y tableros en el prompt. |
| `public/index.html` | Modificado (+6,230 lín.) | Inclusión de marcado de modales D&D, cajón de grupo y superposiciones. |
| `public/css/world-map.css` | 1,383 líneas | Estilos de zoom, cuadrícula, tokens y niebla de guerra. |
| `public/css/dnd-character.css`| 1,330 líneas | Estilos de ficha de personaje, inventario, ranuras y estados. |
| `public/css/campaigns.css` | 1,301 líneas | Estilos de tarjetas de campaña y vista de bienvenida. |
| `public/css/world-content-browser.css` | 794 líneas | Estilos de cuadrícula de entidades de mundo y modales Fable-like. |
| `public/css/dynamic-context-manager.css`| 355 líneas | Estilos del modal de reglas y barra de presupuesto de tokens. |
| `public/css/chat-enhancements.css` | 149 líneas | Estilos de hipervínculos resaltados y avatares en línea. |

---

## 3. Inventario de Archivos Clave de SillyTavern Core

| Archivo | Función Principal |
| :--- | :--- |
| `server.js` | Script de entrada raíz (`node server.js`). |
| `src/server-main.js` | Configuración de Express, middlewares globales y ciclo de vida del proceso. |
| `src/server-startup.js` | Enlace de puertos de red IPv4/IPv6 y registro de endpoints privados. |
| `src/command-line.js` | Definición de argumentos de consola (`--port`, `--ssl`, `--listen`, etc.). |
| `src/config-init.js` | Lectura de `config.yaml` y establecimiento de valores por defecto. |
| `src/users.js` | Gestión de cuentas de usuario, sesiones firmadas, Scrypt y carpetas en `data/`. |
| `src/endpoints/characters.js` | Lectura y escritura de tarjetas de personaje V2/V3 en imágenes PNG. |
| `src/endpoints/chats.js` | Operaciones CRUD de historiales de conversación en archivos JSONL. |
| `src/endpoints/worldinfo.js` | Operaciones CRUD de Lorebooks en archivos JSON. |
| `src/endpoints/secrets.js` | Gestión y ocultación de API keys en `secrets.json`. |
| `public/scripts/slash-commands.js` | Parser y ejecutor de comandos `/` de la interfaz. |
| `public/scripts/tokenizers.js` | Recuento local de tokens mediante WASM (`tiktoken`, `sentencepiece`). |
| `public/scripts/group-chats.js` | Lógica de conversaciones con múltiples personajes simultáneos. |
| `public/scripts/power-user.js` | Ajustes avanzados de interfaz y parámetros de comportamiento. |

---

## 4. Enlaces Relacionados
- [[Arquitectura-General]]: Visión de conjunto de la arquitectura.
- [[Guia-Desarrollo-Flujo]]: Instrucciones para ejecutar, depurar y programar en el proyecto.
- [[PROBLEMAS_TECNICOS]]: Diagnóstico técnico y deuda encontrada en estos archivos.
- [[PROPUESTAS_MEJORA]]: Propuestas de refactorización y desacoplamiento.
