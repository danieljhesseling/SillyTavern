---
title: SillyTavern RPG Engine - Punto de Entrada Principal
tags: [home, portal, silleytavern, rpg, dnd, obsidian, wiki]
created: 2026-09-20
author: DanielJHesseling / Antigravity AI
---

# 🏰 SillyTavern RPG Engine - Portal de Inicio (HOME)

Bienvenido al repositorio de **SillyTavern & Motor RPG** (rama `my-silly` de DanielJHesseling).

Este repositorio alberga la plataforma de chat con IA SillyTavern enriquecida con un **motor de juego de rol de mesa (VTT / RPG)** integrado: gestión de grupo (party), combate táctico, mapas con cuadrícula zoomable, niebla de guerra, filtrado dinámico de contexto (Dynamic Context Manager) y fichas de personaje completas basadas en D&D 5e.

---

## 📖 Wiki Completa para Obsidian

Toda la documentación técnica, arquitectónica y de jugabilidad está organizada en la carpeta `wiki/` como una bóveda optimizada para **Obsidian**:

### 👉 [Acceder al Hub Central de la Wiki: wiki/HOME.md](file:///c:/Users/danie/SillyTavern/wiki/HOME.md) (o en Obsidian: [[HOME]])

---

## 🧭 Accesos Rápidos Principales

### 🏛️ Arquitectura & Sistema
- **[[Arquitectura-General]]**: [01-arquitectura/Arquitectura-General.md](file:///c:/Users/danie/SillyTavern/wiki/01-arquitectura/Arquitectura-General.md)
- **[[Backend-Express]]**: [01-arquitectura/Backend-Express.md](file:///c:/Users/danie/SillyTavern/wiki/01-arquitectura/Backend-Express.md)
- **[[Frontend-Estructura]]**: [01-arquitectura/Frontend-Estructura.md](file:///c:/Users/danie/SillyTavern/wiki/01-arquitectura/Frontend-Estructura.md)
- **[[Almacenamiento-Persistencia]]**: [01-arquitectura/Almacenamiento-Persistencia.md](file:///c:/Users/danie/SillyTavern/wiki/01-arquitectura/Almacenamiento-Persistencia.md)
- **[[Ciclo-De-Vida-Prompt]]**: [01-arquitectura/Ciclo-De-Vida-Prompt.md](file:///c:/Users/danie/SillyTavern/wiki/01-arquitectura/Ciclo-De-Vida-Prompt.md)

### 🧠 Subsistemas Core de SillyTavern
- **[[Conectores-IA]]**: [02-subsistemas-core/Conectores-IA.md](file:///c:/Users/danie/SillyTavern/wiki/02-subsistemas-core/Conectores-IA.md)
- **[[WorldInfo-Lorebooks]]**: [02-subsistemas-core/WorldInfo-Lorebooks.md](file:///c:/Users/danie/SillyTavern/wiki/02-subsistemas-core/WorldInfo-Lorebooks.md)
- **[[SlashCommands-Macros]]**: [02-subsistemas-core/SlashCommands-Macros.md](file:///c:/Users/danie/SillyTavern/wiki/02-subsistemas-core/SlashCommands-Macros.md)
- **[[Extensiones-Plugins]]**: [02-subsistemas-core/Extensiones-Plugins.md](file:///c:/Users/danie/SillyTavern/wiki/02-subsistemas-core/Extensiones-Plugins.md)
- **[[Seguridad-Autenticacion]]**: [02-subsistemas-core/Seguridad-Autenticacion.md](file:///c:/Users/danie/SillyTavern/wiki/02-subsistemas-core/Seguridad-Autenticacion.md)

### ⚔️ Motor RPG & Campañas D&D 5e (Fork danieljhesseling)
- **[[Sistema-Party]]**: [03-motor-rpg/Sistema-Party.md](file:///c:/Users/danie/SillyTavern/wiki/03-motor-rpg/Sistema-Party.md)
- **[[DND-Mecanicas-Items]]**: [03-motor-rpg/DND-Mecanicas-Items.md](file:///c:/Users/danie/SillyTavern/wiki/03-motor-rpg/DND-Mecanicas-Items.md)
- **[[Dynamic-Context-Manager]]**: [03-motor-rpg/Dynamic-Context-Manager.md](file:///c:/Users/danie/SillyTavern/wiki/03-motor-rpg/Dynamic-Context-Manager.md)
- **[[Campanas-Mapas-Tableros]]**: [03-motor-rpg/Campanas-Mapas-Tableros.md](file:///c:/Users/danie/SillyTavern/wiki/03-motor-rpg/Campanas-Mapas-Tableros.md)
- **[[World-Content-Popups]]**: [03-motor-rpg/World-Content-Popups.md](file:///c:/Users/danie/SillyTavern/wiki/03-motor-rpg/World-Content-Popups.md)
- **[[Relaciones-Memorias]]**: [03-motor-rpg/Relaciones-Memorias.md](file:///c:/Users/danie/SillyTavern/wiki/03-motor-rpg/Relaciones-Memorias.md)
- **[[Chat-Enhancements]]**: [03-motor-rpg/Chat-Enhancements.md](file:///c:/Users/danie/SillyTavern/wiki/03-motor-rpg/Chat-Enhancements.md)

### 🎯 Planes, Hojas de Ruta & Diseño de Juego
- **[[ROADMAP]]**: [wiki/ROADMAP.md](file:///c:/Users/danie/SillyTavern/wiki/ROADMAP.md) - *El plan de trabajo único en fases ejecutables con pruebas en navegador y CI.*
- **[[POR_HACER]]**: [wiki/POR_HACER.md](file:///c:/Users/danie/SillyTavern/wiki/POR_HACER.md) - *Lista viva de estado real, tareas conectadas y decisiones.*
- **[[PROPUESTA_JUEGO_DND_GLOOMHAVEN_PERSONA]]**: [wiki/PROPUESTA_JUEGO_DND_GLOOMHAVEN_PERSONA.md](file:///c:/Users/danie/SillyTavern/wiki/PROPUESTA_JUEGO_DND_GLOOMHAVEN_PERSONA.md) - *Diseño del motor híbrido D&D 5e + Gloomhaven + Persona.*
- **[[ROADMAP_INGESTA_CAMPANAS_LIBROS]]**: [wiki/ROADMAP_INGESTA_CAMPANAS_LIBROS.md](file:///c:/Users/danie/SillyTavern/wiki/ROADMAP_INGESTA_CAMPANAS_LIBROS.md) - *Pipeline de ingesta de libros/PDFs a campañas jugables mediante Gemini.*
- **[[PROPUESTA_FRONTEND_MODO_JUEGO]]**: [wiki/PROPUESTA_FRONTEND_MODO_JUEGO.md](file:///c:/Users/danie/SillyTavern/wiki/PROPUESTA_FRONTEND_MODO_JUEGO.md) - *Game Shell: 3 pantallas cinemáticas a pantalla completa (Diálogo, Mapa, Combate).*
- **[[PLAN_JUEGO_TIPO_FRIENDS_AND_FABLES]]**: [wiki/PLAN_JUEGO_TIPO_FRIENDS_AND_FABLES.md](file:///c:/Users/danie/SillyTavern/wiki/PLAN_JUEGO_TIPO_FRIENDS_AND_FABLES.md) - *Hacia la experiencia Friends & Fables (DM autónomo, descansos, magia y level-up, sin marketplace).*
- **[[ROADMAP_JUEGO_SIN_COMANDOS]]**: [wiki/ROADMAP_JUEGO_SIN_COMANDOS.md](file:///c:/Users/danie/SillyTavern/wiki/ROADMAP_JUEGO_SIN_COMANDOS.md) - *Juego 100% por clics de ratón: mover y atacar en el tablero, descansos interactivos y action chips.*
- **[[DISENO_GENERADOR_MUNDOS_PROFUNDO]]**: [wiki/DISENO_GENERADOR_MUNDOS_PROFUNDO.md](file:///c:/Users/danie/SillyTavern/wiki/DISENO_GENERADOR_MUNDOS_PROFUNDO.md) - *Generador de mundos profundo: 7 categorías maestras (Personajes, Enemigos, Mapa Mundi, Localidades, Tableros, Facciones, Magias) y esquema JSON unificado.*

### 🔍 Auditoría & Propuestas de Mejora
- **[[PROBLEMAS_TECNICOS]]**: [wiki/PROBLEMAS_TECNICOS.md](file:///c:/Users/danie/SillyTavern/wiki/PROBLEMAS_TECNICOS.md) - *Auditoría técnica exhaustiva (vulnerabilidades XSS, CSP, desincronización de estado, fugas de memoria y deuda técnica).*
- **[[PROPUESTAS_MEJORA]]**: [wiki/PROPUESTAS_MEJORA.md](file:///c:/Users/danie/SillyTavern/wiki/PROPUESTAS_MEJORA.md) - *Catálogo de 200 propuestas técnicas estructuradas en 10 áreas estratégicas.*

### 🛠️ Guías de Referencia
- **[[Mapa-Codigo-Archivos]]**: [wiki/04-guias-referencia/Mapa-Codigo-Archivos.md](file:///c:/Users/danie/SillyTavern/wiki/04-guias-referencia/Mapa-Codigo-Archivos.md)
- **[[Guia-Desarrollo-Flujo]]**: [wiki/04-guias-referencia/Guia-Desarrollo-Flujo.md](file:///c:/Users/danie/SillyTavern/wiki/04-guias-referencia/Guia-Desarrollo-Flujo.md)

---

## ⚡ Comandos Rápidos de Ejecución

```bash
# Iniciar el servidor localmente (puerto 8000)
npm start

# Iniciar en modo depuración
npm run debug

# Iniciar con Electron (App de escritorio)
npm run start:electron
```
