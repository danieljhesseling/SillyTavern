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

### 🔍 Auditoría & Propuestas de Mejora
- **[[PROBLEMAS_TECNICOS]]**: [wiki/PROBLEMAS_TECNICOS.md](file:///c:/Users/danie/SillyTavern/wiki/PROBLEMAS_TECNICOS.md) - *Auditoría técnica exhaustiva (vulnerabilidades XSS, CSP, desincronización de estado, fugas de memoria y deuda técnica).*
- **[[PROPUESTAS_MEJORA]]**: [wiki/PROPUESTAS_MEJORA.md](file:///c:/Users/danie/SillyTavern/wiki/PROPUESTAS_MEJORA.md) - *Catálogo de **200 propuestas técnicas estructuradas** en 10 áreas estratégicas.*

### 🛠️ Guías de Referencia
- **[[Mapa-Codigo-Archivos]]**: [04-guias-referencia/Mapa-Codigo-Archivos.md](file:///c:/Users/danie/SillyTavern/wiki/04-guias-referencia/Mapa-Codigo-Archivos.md)
- **[[Guia-Desarrollo-Flujo]]**: [04-guias-referencia/Guia-Desarrollo-Flujo.md](file:///c:/Users/danie/SillyTavern/wiki/04-guias-referencia/Guia-Desarrollo-Flujo.md)

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
