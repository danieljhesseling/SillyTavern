---
title: Catálogo de 200 Propuestas de Mejora para SillyTavern & Motor RPG
tags: [propuestas, mejoras, roadmap, arquitectura, seguridad, dnd, rendimiento, ui-ux, ia]
created: 2026-09-20
author: DanielJHesseling / Antigravity AI
---

# Catálogo de 200 Propuestas de Mejora para SillyTavern & Motor RPG

Este documento recopila **200 propuestas técnicas, de arquitectura, de jugabilidad y de optimización** diseñadas para transformar SillyTavern en una plataforma de última generación para juegos de rol impulsados por inteligencia artificial.

Las propuestas están organizadas en 10 áreas estratégicas de 20 propuestas cada una.

---

## Índice General de Áreas

1. [Área 1: Arquitectura, Refactorización & Modularización](#área-1-arquitectura-refactorización--modularización-prop-001-a-prop-020) (PROP-001 a PROP-020)
2. [Área 2: Seguridad, Criptografía & Aislamiento](#área-2-seguridad-criptografía--aislamiento-prop-021-a-prop-040) (PROP-021 a PROP-040)
3. [Área 3: Rendimiento, Virtualización & Memoria](#área-3-rendimiento-virtualización--memoria-prop-041-a-prop-060) (PROP-041 a PROP-060)
4. [Área 4: Motor de Juego D&D 5e & Fichas](#área-4-motor-de-juego-dd-5e--fichas-prop-061-a-prop-080) (PROP-061 a PROP-080)
5. [Área 5: Combate Táctico, Tableros & Niebla (VTT)](#área-5-combate-táctico-tableros--niebla-vtt-prop-081-a-prop-100) (PROP-081 a PROP-100)
6. [Área 6: Dynamic Context Manager & Prompts](#área-6-dynamic-context-manager--prompts-prop-101-a-prop-120) (PROP-101 a PROP-120)
7. [Área 7: Modelos de Lenguaje, Function Calling & Agentes](#área-7-modelos-de-lenguaje-function-calling--agentes-prop-121-a-prop-140) (PROP-121 a PROP-140)
8. [Área 8: Experiencia de Usuario (UI/UX) & Accesibilidad](#área-8-experiencia-de-usuario-uiux--accesibilidad-prop-141-a-prop-160) (PROP-141 a PROP-160)
9. [Área 9: Persistencia, Sincronización & Base de Datos](#área-9-persistencia-sincronización--base-de-datos-prop-161-a-prop-180) (PROP-161 a PROP-180)
10. [Área 10: Ecosistema de Extensiones, DevOps & Testing](#área-10-ecosistema-de-extensiones-devops--testing-prop-181-a-prop-200) (PROP-181 a PROP-200)

---

## Área 1: Arquitectura, Refactorización & Modularización (PROP-001 a PROP-020)

- **PROP-001: Descomposición Modular de `party.js`**: Dividir el monolito de 4,734 líneas en submódulos especializados (`party-state.js`, `party-ui.js`, `party-combat.js`, `party-dice.js`) bajo `public/scripts/party/`.
- **PROP-002: Eliminación Gradual de jQuery en Favor de Vanilla DOM Moderno**: Reemplazar selectores y mutaciones `$()` por `document.querySelector`, `classList` y `dataset` nativos, eliminando 80 KB de biblioteca y mejorando los tiempos de ejecución.
- **PROP-003: Migración Gradual a TypeScript (`.ts`)**: Introducir tipado estricto en el motor RPG para erradicar errores de tipo en tiempo de ejecución en inventario, miembros del grupo y estados de campaña.
- **PROP-004: Adopción de un Bundler Moderno (Vite)**: Sustituir la carga dispersa de scripts en el navegador por un empaquetador como Vite o Rollup con tree-shaking, minificación y hot module replacement (HMR).
- **PROP-005: Desacoplamiento de Plantillas HTML (`index.html`)**: Extraer los 50 modales embebidos en `index.html` a plantillas HTML/WebComponents independientes cargadas bajo demanda.
- **PROP-006: Creación de un Store de Estado Reactivo Centralizado**: Implementar un almacén de estado predecible (patrón Zustand / NanoStores) para gestionar `chat`, `partyMembers`, `chat_metadata` y configuración sin depender de variables globales en `window`.
- **PROP-007: Centralización de Utilidades en `dnd-system.js`**: Eliminar duplicaciones de funciones como `normalizeDndEntityType` entre `party.js` y `world-info.js`, unificándolas en un módulo canónico.
- **PROP-008: Abstracción de Capa de Transporte de Red**: Crear un cliente HTTP tipado (`api-client.ts`) que gestione automáticamente cabeceras CSRF, reintentos exponenciales y serialización JSON.
- **PROP-009: Estandarización del Manejo de Errores en Endpoints**: Reemplazar bloques `catch (e) {}` silenciosos por un middleware global de errores en Express que emita respuestas normalizadas `{ error: string, code: number }`.
- **PROP-010: Separación de Lógica de Negocio y Presentación en `world-map-renderer.js`**: Aislar el cálculo de coordenadas, transformaciones y niebla de guerra de la manipulación visual del DOM.
- **PROP-011: Refactorización de `script.js` en Controladores de Dominio**: Descomponer el archivo principal de 12,000 líneas en controladores específicos (`ChatController`, `CharacterController`, `PromptPipelineController`).
- **PROP-012: Inyección de Dependencias en Servicios del Backend**: Configurar un contenedor de inversión de control (IoC) ligero para instanciar repositorios de usuarios, personajes y chats.
- **PROP-013: Normalización de Nombres de Eventos**: Unificar constantes de eventos en un único enum `EVENTS` para evitar discrepancias entre cadenas mágicas en `eventSource`.
- **PROP-014: Creación de un Bus de Eventos Tipado**: Extender `EventEmitter` con firmas genéricas para validar las cargas útiles emitidas en eventos como `PARTY_MEMBER_UPDATED`.
- **PROP-015: Aislamiento del Subsistema D&D como Módulo Núcleo Autónomo**: Diseñar el motor RPG como un paquete interno con interfaces limpias para facilitar su mantenimiento sin alterar el chat base.
- **PROP-016: Desacoplamiento de la Persistencia en Memoria del Chat**: Separar el modelo de datos de la sesión del árbol de elementos visuales `.mes` del DOM.
- **PROP-017: Introducción de Web Workers para Tareas Pesadas**: Delegar la tokenización de grandes volúmenes de texto y el cálculo de matrices de distancias en tableros a un Web Worker en segundo plano.
- **PROP-018: Esquema de Validación JSON Schema / Zod para `chat_metadata`**: Validar automáticamente la integridad estructural de metadatos al cargarlos desde disco para evitar corrupciones silenciosas.
- **PROP-019: Pipeline Unificado de Filtros de Texto**: Encapsular el formateo Markdown, sanitización DOMPurify y resaltado de Lorebook en una tubería secuencial (`TextPipeline`).
- **PROP-020: Modularización de Hojas de Estilo CSS**: Reorganizar `style.css` y hojas D&D mediante variables CSS (design tokens) e imports lógicos.

---

## Área 2: Seguridad, Criptografía & Aislamiento (PROP-021 a PROP-040)

- **PROP-021: Configuración de Content Security Policy (CSP) Estricta**: Habilitar CSP en Helmet con nonces aleatorios por sesión, bloqueando scripts en línea no autorizados.
- **PROP-022: Sanitización Sistemática contra XSS en `world-map-renderer.js`**: Usar constructores seguros del DOM (`.text()`) en lugar de interpolación cruda en etiquetas de tokens.
- **PROP-023: Unificación de Función `escapeHtml` Segura**: Crear una utilidad universal basada en el escape estricto de las 5 entidades HTML y validación de atributos.
- **PROP-024: Cifrado en Reposo de Claves de API (`secrets.json`)**: Implementar cifrado simétrico **AES-256-GCM** para almacenar claves de proveedores de IA.
- **PROP-025: Actualización de jQuery a v3.7.1**: Parchear las vulnerabilidades CVE-2020-11022 y CVE-2020-11023 actualizando la biblioteca.
- **PROP-026: Sandboxing Seguro para la Ejecución de Macros**: Aislar la ejecución de macros complejas mediante un entorno de evaluación restringido sin acceso a `window` ni `document`.
- **PROP-027: Validación Estricta de Tipos MIME en Archivos Subidos**: Comprobar firmas mágicas de bytes (magic numbers) en avatares y mapas para evitar subidas de scripts camuflados.
- **PROP-028: Rotación Automática del Secreto de Sesión**: Proporcionar comandos para rotar periódicamente la clave HMAC de cookies sin invalidar sesiones de forma abrupta.
- **PROP-029: Auditoría de Dependencias Automatizada (`npm audit`) en CI/CD**: Integrar revisiones continuas de vulnerabilidades en el pipeline de GitHub Actions.
- **PROP-030: Rate Limiting Configurable por Endpoint**: Limitar peticiones excesivas en `/api/characters/*` y `/api/chats/*` para prevenir ataques de denegación de servicio local.
- **PROP-031: Control de Acceso Basado en Roles (RBAC) para Modo Multi-Usuario**: Añadir roles de Administrador, Creador y Jugador para restringir el borrado de mundos compartidos.
- **PROP-032: Sanitización de Atributos de Imagen en Avatares de Diálogo**: Filtrar URLs y etiquetas `src` en `chat-enhancements.js` para evitar inyecciones de esquemas `javascript:`.
- **PROP-033: Validación Antifraude en la Importación de Personajes**: Escanear campos de tarjetas PNG importadas en busca de payloads XSS antes de escribirlas en disco.
- **PROP-034: Cabeceras de Seguridad Avanzadas en Express**: Incorporar `Permissions-Policy`, `X-Content-Type-Options: nosniff` y `Referrer-Policy: strict-origin-when-cross-origin`.
- **PROP-035: Modo de Navegación Aislada (Incógnito / Efímero)**: Permitir crear sesiones temporales de juego donde los chats y datos no se guarden en disco al cerrar.
- **PROP-036: Encriptación Opcional de Conversaciones y Fichas en Disco**: Ofrecer cifrado de archivos JSONL para usuarios que manejan datos sensibles en equipos compartidos.
- **PROP-037: Sanitización de Nombres de Campaña y Mundos**: Validar estrictamente las cadenas de texto usadas para generar rutas de archivo evitando secuencias `../`.
- **PROP-038: Bloqueo de Peticiones Cross-Origin no Autorizadas en Servidor**: Restringir las cabeceras CORS en Express para permitir únicamente el origen configurado en `config.yaml`.
- **PROP-039: Registro de Auditoría de Seguridad (Security Audit Log)**: Registrar intentos fallidos de inicio de sesión, cambios de contraseña y accesos a claves de API.
- **PROP-040: Detección y Alerta de Modales Ocultos Maliciosos**: Escanear extensiones instaladas para evitar que inyecten elementos `iframe` invisibles en el DOM.

---

## Área 3: Rendimiento, Virtualización & Memoria (PROP-041 a PROP-060)

- **PROP-041: Virtualización del Historial de Chat (DOM Virtualization)**: Renderizar únicamente los mensajes visibles en el viewport más un pequeño buffer, reduciendo el consumo de RAM en chats de más de 500 mensajes.
- **PROP-042: Sustitución de Regex Masiva por Algoritmo Aho-Corasick**: Reemplazar la expresión regular combinada en `chat-enhancements.js` por un autómata de búsqueda de palabras clave en tiempo $O(N)$.
- **PROP-043: Implementación de Método `destroy()` en `createZoomableContainer`**: Desacoplar todos los listeners jQuery y liberar instancias al cerrar o cambiar de mapa.
- **PROP-044: Procesamiento Asíncrono de Imágenes con Sharp en Worker Threads**: Reemplazar Jimp por Sharp/Libvips para redimensionar y comprimir imágenes hasta 5x más rápido sin bloquear el event loop.
- **PROP-045: Paginación Perezosa (Lazy Loading) de Tarjetas de Campaña**: Cargar los metadatos de las campañas de bienvenida en bloques de 10 en lugar de leer 100 chats simultáneos.
- **PROP-046: Caché LRU en Memoria para Fichas de Personajes**: Almacenar las tarjetas de personaje más utilizadas en una caché LRU para evitar lecturas continuas a disco.
- **PROP-047: Compresión de Historiales JSONL Antiguos**: Comprimir chats inactivos con Brotli o Gzip en segundo plano para ahorrar espacio en disco.
- **PROP-048: Reducción de Reflows del DOM en el Cajón de Grupo**: Agrupar las mutaciones de la barra de salud y experiencia en un solo ciclo de `requestAnimationFrame`.
- **PROP-049: Carga Diferida de Fuentes y Recursos Multimedia**: Usar `font-display: swap` y lazy loading nativo (`loading="lazy"`) en todas las imágenes de inventario y avatares.
- **PROP-050: Indexación en Memoria de Entradas de Lorebook**: Mantener un mapa hash precalculado de claves de World Info para búsquedas instantáneas en cada turno.
- **PROP-051: Paginación de Cuadrículas en el Navegador de Contenido**: Mostrar monstruos y objetos en lotes de 24 elementos por página con scroll infinito.
- **PROP-052: Renderizado Acelerado por GPU para Niebla de Guerra**: Utilizar un elemento `<canvas>` 2D acelerado en lugar de máscaras DOM complejas para la niebla de guerra.
- **PROP-053: Optimización de la Caché de Tokens en Dynamic Context**: Persistir el recuento de tokens de instrucciones estáticas para no recalcular `getTokenCountAsync()` en cada mensaje.
- **PROP-054: Reducción de Carga en Streaming SSE**: Agrupar tokens de streaming en paquetes de 3-5 tokens o emitirlos mediante micro-animaciones CSS para suavizar la renderización.
- **PROP-055: Limpieza Periódica de Nodos Huérfanos del DOM**: Implementar un recolector que elimine tooltips y modales secundarios descartados que no hayan sido destruidos.
- **PROP-056: Pre-compilación de Plantillas de Diálogo**: Compilar previamente las plantillas de visualización en funciones JS puras en lugar de parsear HTML con jQuery en cada llamada.
- **PROP-057: Monitor de Rendimiento y Consumo de Memoria en Vivo**: Mostrar un panel opcional para desarrolladores con FPS, nodos DOM activos y uso del heap de JavaScript.
- **PROP-058: Descarga Selectiva de Formatos de Audio TTS**: Cachear fragmentos de audio sintetizados en el navegador mediante IndexedDB para evitar peticiones repetidas.
- **PROP-059: Caché Eficiente de Consultas Vectoriales RAG**: Guardar los resultados de búsqueda semántica más recientes para no re-ejecutar similitudes de coseno si el contexto no ha cambiado.
- **PROP-060: Suspensión de Animaciones en Pestañas en Segundo Plano**: Pausar la física de dados y transiciones visuales cuando la ventana del navegador pierda el foco (`visibilitychange`).

---

## Área 4: Motor de Juego D&D 5e & Fichas (PROP-061 a PROP-080)

- **PROP-061: Gestor de Espacios de Conjuro (Spell Slots)**: Añadir casillas interactivas para rastrear espacios de conjuro gastados y disponibles de nivel 1 a 9.
- **PROP-062: Sistema de Descanso Corto y Descanso Largo**: Implementar botones para gastar Dados de Golpe (`Hit Dice`) en descansos cortos o recuperar todos los recursos en descansos largos.
- **PROP-063: Cálculo Automatizado de Tiradas de Salvación y Habilidades**: Mostrar bonificadores desglosados (Atributo + Competencia) para las 18 habilidades de D&D 5e.
- **PROP-064: Soporte para Clases Híbridas y Multiclase**: Permitir que un miembro del grupo posea múltiples clases (ej. Guerrero 3 / Mago 2) con cálculo unificado de niveles.
- **PROP-065: Registro de Acciones y Rasgos de Clase**: Añadir una pestaña de Habilidades Especiales (ej. *Acción Súbita*, *Furia Bárbara*, *Ataque Furtivo*) con contadores de uso.
- **PROP-066: Generador Aleatorio de PNJs y Monstruos**: Botón para crear instantáneamente estadísticas de un guardia, bandido o mercader según el nivel del grupo.
- **PROP-067: Tablas de Botín Aleatorio (Loot Tables)**: Sistema de recompensas basado en la Guía del Dungeon Master para generar cofres y tesoros por Desafío (CR).
- **PROP-068: Importación / Exportación de Fichas en Formato D&D Beyond / Foundry VTT**: Conversores de esquemas JSON para reutilizar personajes de otras plataformas de rol.
- **PROP-069: Rastreador de Munición y Componentes Materiales**: Descontar automáticamente flechas, virotes y componentes valiosos con coste en oro al declarar ataques o conjuros.
- **PROP-070: Modos de Armadura para Clases sin Armadura (Monje / Bárbaro)**: Calcular la Defensa sin Armadura sumando Sabiduría o Constitución a la AC base.
- **PROP-071: Efectos de Condiciones Dinámicas en Estadísticas**: Al marcar un personaje como *Envenenado* o *Fatigado*, reflejar automáticamente la desventaja en tiradas en la ficha.
- **PROP-072: Sistema de Deidades y Dominios para Clérigos y Paladines**: Registrar juramentos sagrados y canalizaciones de divinidad.
- **PROP-073: Sistema de Compañeros Animales, Familiares y Monturas**: Vincular fichas secundarias asociadas a un miembro del grupo con estadísticas independientes.
- **PROP-074: Monedero Convertible Automático**: Opción para convertir automáticamente monedas (ej. 100 monedas de cobre a 1 moneda de oro) para facilitar la contabilidad.
- **PROP-075: Gestor de Resistencias, Inmunidades y Vulnerabilidades**: Campos para marcar inmunidad al daño de veneno o resistencia al fuego con cálculo automático de daño recibido.
- **PROP-076: Automatización de Tiradas de Salvación contra la Muerte (Death Saves)**: Cuadrículas de tres éxitos y tres fallos cuando un personaje cae a 0 HP con tirada automática de 1d20.
- **PROP-077: Calculador de Nivel de Desafío de Encuentros (Encounter Builder)**: Indicador visual que evalúa si un combate es Fácil, Medio, Difícil o Mortal según la suma de XP del grupo.
- **PROP-078: Historial de Daño y Curación en Tiempo Real**: Bitácora desplegable que muestra las últimas fuentes de daño o curación recibidas por cada personaje.
- **PROP-079: Hojas de Personaje Especializadas por Sistema (Pathfinder 2e, CoC)**: Modularizar la ficha para permitir sistemas alternativos a D&D 5e mediante presets de reglas.
- **PROP-080: Modo Resumen Compacto para Dispositivos Móviles**: Vista minimalista de la ficha con accesos rápidos a HP, AC y tiradas de ataque prioritarias.

---

## Área 5: Combate Táctico, Tableros & Niebla (VTT) (PROP-081 a PROP-100)

- **PROP-081: Rastreador de Turnos e Iniciativa (Turn Tracker)**: Panel flotante que ordena a todos los tokens del tablero por su tirada de iniciativa y destaca al combatiente en turno.
- **PROP-082: Plantillas de Áreas de Efecto (AoE Templates)**: Herramientas para dibujar círculos de 20 pies (Bolas de Fuego), conos de 15 pies y líneas de relámpago sobre la cuadrícula.
- **PROP-083: Medidor de Distancia y Movimiento Restante**: Regla interactiva que mide pies recorridos al arrastrar un token y avisa si supera la velocidad del personaje.
- **PROP-084: Motor de Línea de Visión (Line of Sight - LoS)**: Bloqueo de visión y cálculo de coberturas (+2 AC por cobertura media, +5 por cobertura tres cuartos) tras muros.
- **PROP-085: Cuadrículas Hexagonales (Hex Grid)**: Soporte alternativo a la cuadrícula cuadrada para mapas de exploración en mundo abierto (hexcrawl).
- **PROP-086: Ajuste a la Cuadrícula Automático (Grid Snapping)**: Centrado magnético suave de los tokens al soltarlos en una celda.
- **PROP-087: Rotación y Orientación de Tokens**: Indicador de dirección hacia donde mira el personaje o monstruo.
- **PROP-088: Marcadores de Estado sobre Tokens**: Iconos flotantes en miniatura sobre la ficha táctica (ej. icono de fuego para quemado, calavera para caído).
- **PROP-089: Soporte para Múltiples Capas (Capas de Mapa, Tokens y Niebla)**: Control de capas para que el usuario pueda dibujar o colocar elementos sin mover el mapa de fondo.
- **PROP-090: Exportación de Tableros como Imágenes o PDFs**: Botón para guardar el estado táctico actual del encuentro con su cuadrícula y posiciones.
- **PROP-091: Niebla de Guerra Dinámica por Antorchas y Visión en la Oscuridad**: Radio de visión personal para cada token que revela el mapa automáticamente según su rango (ej. 60 pies).
- **PROP-092: Indicadores de Elevación y Vuelo**: Campo numérico sobre el token para representar altitud o profundidad (ej. `+15 ft`).
- **PROP-093: Animaciones de Ataque y Proyectiles**: Efectos visuales ligeros en canvas para representar flechas volando o impactos de hechizos entre casillas.
- **PROP-094: Sonidos de Pasos y Ambiente Táctico**: Reproducción de efectos de sonido acordes al terreno del tablero (piedra, bosque, agua) al mover tokens.
- **PROP-095: Biblioteca de Tokens Genéricos Integrada**: Colección de iconos predefinidos de aventureros, aldeanos y criaturas clásicas listos para usar.
- **PROP-096: Soporte para Mapas Animados (WebM / MP4)**: Reproducción de mapas con cascadas, lava o lluvia en bucle como fondo de tablero.
- **PROP-097: Selección Múltiple de Tokens y Movimiento en Grupo**: Capacidad de seleccionar varios aliados con una caja de selección y desplazarlos a la vez.
- **PROP-098: Registro de Coordenadas Históricas (Migas de Pan)**: Rastro semitransparente que muestra el camino recorrido por los personajes en la sesión.
- **PROP-099: Escalado de Tokens por Tamaño D&D**: Ajuste del tamaño del token según la categoría: Pequeño/Medio (1x1), Grande (2x2), Enorme (3x3), Gargantuesco (4x4).
- **PROP-100: Modo Cine / Pantalla Completa para Tableros**: Botón para ocultar barras de menú y disfrutar del mapa táctico a pantalla completa.

---

## Área 6: Dynamic Context Manager & Prompts (PROP-101 a PROP-120)

- **PROP-101: Compresión Jerárquica de Instrucciones**: Resumir automáticamente instrucciones de baja prioridad mediante llamadas secundarias de IA antes de inyectarlas.
- **PROP-102: Disparadores Temporales para Instrucciones**: Reglas dinámicas que se activen solo durante un número determinado de turnos (ej. efecto de un hechizo durante 10 turnos).
- **PROP-103: Perfiles de Campaña Predefinidos**: Plantillas con presupuestos y reglas afinadas para Fantasía Épica, Terror Gótico, Cyberpunk o Investigación Urbana.
- **PROP-104: Vista Previa del Prompt Compilado**: Modal de depuración que muestra el texto exacto que se enviará al LLM con código de colores según el origen de cada bloque.
- **PROP-105: Transiciones Automáticas de Estado de Campaña**: Detectar patrones en la salida del modelo (ej. aparición de la palabra "¡Iniciativa!") para cambiar de `exploration` a `combat`.
- **PROP-106: Instrucciones Negativas y Restricciones Estrictas**: Reglas que prohíban explícitamente ciertos comportamientos del modelo según la escena (ej. "No resuelvas la acción del jugador por él").
- **PROP-107: Soporte para Variables Numéricas en Condiciones**: Reglas que se activen solo si se cumple una condición matemática (ej. `HP < 20%` activa instrucciones de desesperación o agonía).
- **PROP-108: Biblioteca Comunitaria de Reglas de Dynamic Context**: Exportación e importación de paquetes de instrucciones en formato JSON compartibles entre usuarios.
- **PROP-109: Integración de Vector RAG en Dynamic Context**: Buscar semánticamente en las reglas de campaña las instrucciones más relevantes para el turno actual.
- **PROP-110: Asignación de Roles Específicos por Instrucción**: Permitir definir si una instrucción se inyecta con rol `system`, `user` o como prefill de `assistant`.
- **PROP-111: Detección Automática de Coherencia Espacial**: Alertar al usuario si el LLM menciona que un enemigo está cerca cuando el tablero indica que está a 100 pies.
- **PROP-112: Inyección de Pocas Muestras (Few-Shot Examples) Dinámicas**: Inyectar ejemplos de interacción dialéctica adecuados al tono actual (combate táctico vs diplomacia cortesana).
- **PROP-113: Modulación de Estilo Narrativo según el Estado**: Cambiar la instrucción de estilo a oraciones cortas y urgentes en combate, y prosa rica y sensorial en descanso.
- **PROP-114: Rastreo de Objetivos de Misión (Quest Tracking)**: Sistema de estados para misiones (No iniciada, En progreso, Completada, Fallida) con inyección automática de metas activas.
- **PROP-115: Control de Ruido en Lorebooks por Presupuesto de Tokens**: Forzar que las entradas de World Info también respeten el presupuesto general configurado.
- **PROP-116: Calibración de Tokens Dinámica según el Modelo Seleccionado**: Ajustar el presupuesto automáticamente si se cambia de un modelo de 4k tokens a uno de 128k.
- **PROP-117: Bloqueo de Instrucciones Recurrentes para Evitar Repetición**: No inyectar la misma regla de ambientación durante más de tres turnos seguidos para no volver monótono al modelo.
- **PROP-118: Registro de Instrucciones Disparadas en Metadatos del Mensaje**: Guardar en el objeto `extra` del mensaje qué reglas se activaron exactamente en cada turno para análisis forense.
- **PROP-119: Generador Asistido de Reglas con IA**: Botón para que la IA redacte instrucciones óptimas basadas en una idea o situación descripta por el usuario.
- **PROP-120: Modo de Depuración de Tokens en Tiempo Real**: Advertencias visuales cuando una instrucción consuma más del 30% del presupuesto total por sí sola.

---

## Área 7: Modelos de Lenguaje, Function Calling & Agentes (PROP-121 a PROP-140)

- **PROP-121: Integración Nativa de Function Calling / Tool Calling**: Permitir que el LLM ejecute herramientas formales para modificar HP, inventario o mover tokens mediante esquemas JSON estructurados en lugar de interpretar texto.
- **PROP-122: Visión Multimodal Aplicada a Tableros Tácticos**: Enviar una captura del tablero al modelo de visión (GPT-4o / Claude 3.5) para que describa la escena con comprensión visual del entorno.
- **PROP-123: Orquestación Multi-Agente para PNJs**: Arquitectura donde un agente principal narra el entorno mientras agentes secundarios especializados encarnan a compañeros y enemigos.
- **PROP-124: Soporte para Salidas Estructuradas (JSON Schema Enforcement)**: Forzar gramáticas BNF o salidas JSON garantizadas en modelos locales (vLLM / llama.cpp / KoboldCpp).
- **PROP-125: Modo Dungeon Master Autónomo (Zero-Player Mode)**: Opción para que la IA actúe como director de juego completo, realizando tiradas y gestionando la aventura sin intervención humana.
- **PROP-126: Conector Específico para Modelos de Razonamiento (o1, DeepSeek-R1)**: Gestión de etiquetas `<think>` y tokens de pensamiento sin romper el formateo de la interfaz.
- **PROP-127: Prefill Dinámico para Controlar el Inicio de Respuesta**: Forzar los primeros caracteres del asistente (ej. `*Tiro 1d20 para iniciativa:*`) en modelos Anthropic y Kobold.
- **PROP-128: Caché de Prompts en Proveedores Soportados (Prompt Caching)**: Estructurar los prompts para maximizar el uso de caché en Anthropic y OpenAI, reduciendo costes hasta un 75%.
- **PROP-129: Reintentos Inteligentes con Backoff Exponencial y Fallback de Proveedor**: Si la API de OpenAI falla con un error 500/503, cambiar automáticamente a OpenRouter o Claude sin perder la partida.
- **PROP-130: Integración con Motores de Búsqueda para Lore del Mundo**: Permitir que el modelo consulte wikis de D&D o Wikipedia mediante SerpAPI o DuckDuckGo antes de responder dudas sobre monstruos oficiales.
- **PROP-131: Agente Especializado en Cartografía**: Sub-agente que genere automáticamente nuevos planos o descripciones de cuadrícula cuando los jugadores viajen a zonas inexploradas.
- **PROP-132: Calibración de Samplers Específica para Escenas de Combate**: Reducir la temperatura automáticamente a 0.3 en combate para cálculos matemáticos precisos y elevarla a 0.9 en escenas sociales.
- **PROP-133: Soporte para Modelos Locales en Segundo Plano con Ollama**: Integración directa con el daemon de Ollama detectando modelos instalados sin requerir URL manual.
- **PROP-134: Resumen Periódico Automático del Historial (Context Window Memory)**: Generar condensaciones narrativas cada 20 turnos para mantener coherencia en campañas de cientos de horas.
- **PROP-135: Detección y Mitigación de Alucinaciones Matemáticas**: Interceptar los resultados de tiradas generados por la IA y sustituirlos por el valor del motor determinista de dados si discrepan.
- **PROP-136: Generación de Retratos de Personaje en Vivo mediante ComfyUI / SD**: Botón para generar ilustraciones de la escena o de nuevos PNJs encontrados al vuelo.
- **PROP-137: Evaluación de Sesgo y Coherencia de Personalidad**: Módulo que califique si la respuesta de un PNJ se alinea con sus puntuaciones de alineamiento y relación.
- **PROP-138: Decodificación Especulativa en Inferencia Local**: Soporte para modelos borradores ligeros que aceleren la velocidad de generación de tokens en servidores locales.
- **PROP-139: Mapeo Automático de Diálogos a Voces TTS**: Enviar el texto de cada personaje a su modelo de voz correspondiente en ElevenLabs / AllTalk automáticamente.
- **PROP-140: Control de Temperatura Dinámico por Curva de Entropía**: Ajustar la aleatoriedad token a token según la certidumbre semántica del modelo.

---

## Área 8: Experiencia de Usuario (UI/UX) & Accesibilidad (PROP-141 a PROP-160)

- **PROP-141: Rediseño Moderno Inspirado en VTTs Profesionales**: Modernizar la interfaz con bordes sutiles, micro-animaciones fluidas y desenfoques de fondo (glassmorphism).
- **PROP-142: Temas de Fantasía Oscura y Manuscrito Antiguo**: Paletas de color temáticas (ej. Papiro Antiguo, Mazmorra Oscura, Cristal Arcano).
- **PROP-143: Sistema de Paneles Acoplables y Flotantes (Docking System)**: Permitir al usuario organizar la ficha, el mapa y el chat en columnas lado a lado o en ventanas flotantes.
- **PROP-144: Compatibilidad Total con Lectores de Pantalla (ARIA)**: Añadir atributos `aria-label`, roles semánticos y soporte para navegación completa por teclado.
- **PROP-145: Efectos de Animación de Dados Físicos 3D**: Integrar una biblioteca WebGL ligera (como DiceBox / Three.js) para simular el lanzamiento de dados rodando sobre la mesa.
- **PROP-146: Modo Concentración / Inmersión**: Atajo de teclado (`F11` o botón dedicado) para ocultar todos los menús laterales y dejar únicamente el chat y el tablero.
- **PROP-147: Notificaciones Visuales de Estados Críticos**: Bordes pulsantes en rojo en la pantalla cuando el personaje líder esté a menos del 15% de salud.
- **PROP-148: Personalización de Tipografías Fantásticas**: Permitir elegir fuentes medievales o de fantasía (como Cinzel, MedievalSharp) para encabezados y nombres.
- **PROP-149: Controles Táctiles Optimizados para Tablets y Móviles**: Soporte para gestos de pellizco (pinch-to-zoom) en mapas y deslizamientos (swipes) para alternar paneles.
- **PROP-150: Sonidos de Interfaz Tácticos**: Efectos sutiles al equipar armas, abrir pergaminos, recibir monedas o desenvainar espadas.
- **PROP-151: Previsualización en Vivo de Fichas al Pasar el Cursor**: Desplegar una pequeña tarjeta informativa al colocar el ratón sobre cualquier token o nombre en el chat.
- **PROP-152: Editor Rápido de Estado en un Clic**: Modificar la vida simplemente haciendo clic sobre la barra de salud e ingresando un número relativo (`-5`, `+8`).
- **PROP-153: Buscador Universal con Comando Rápido (`Ctrl + K`)**: Modal de búsqueda global para saltar instantáneamente a cualquier personaje, objeto, mapa o ajuste.
- **PROP-154: Vista Comparativa de Objetos de Inventario**: Al inspeccionar un arma o armadura, mostrar un comparador visual con el objeto actualmente equipado.
- **PROP-155: Indicadores de Retardo y Estado de la Conexión**: Pequeño led en la barra superior que indique latencia y estado del backend o de la API externa.
- **PROP-156: Selector de Idioma Dinámico para Contenido D&D**: Permitir traducir términos estándar (Saving Throw -> Tirada de Salvación) mediante diccionarios en `locales/`.
- **PROP-157: Modo de Alto Contraste para Accesibilidad Visual**: Tema accesible optimizado para personas con baja visión o daltonismo en barras de vida.
- **PROP-158: Animación de Subida de Nivel Triunfal**: Efecto de partículas doradas en pantalla al alcanzar la experiencia requerida para subir de nivel.
- **PROP-159: Exportación de la Sesión en Formato Libro / Crónica**: Generar un archivo Markdown o PDF bellamente maquetado que narre la aventura como si fuera un libro de fantasía.
- **PROP-160: Ayuda Contextual con Guías Interactivas (Tours)**: Pequeños tutoriales guiados que expliquen el uso del cajón de grupo y el Dynamic Context a nuevos usuarios.

---

## Área 9: Persistencia, Sincronización & Base de Datos (PROP-161 a PROP-180)

- **PROP-161: Migración Opcional a Base de Datos Embebida SQLite**: Sustituir la gestión manual de archivos JSON planos por una base de datos relacional ligera con transacciones ACID para evitar corrupciones.
- **PROP-162: Control de Versiones con Git Embebido para Campañas**: Guardar checkpoints de la campaña como commits automáticos en segundo plano, permitiendo retroceder en el tiempo.
- **PROP-163: Sincronización en la Nube con Cifrado Punto a Punto (E2EE)**: Copias de seguridad automáticas hacia servicios de almacenamiento personal (Google Drive, Dropbox, WebDAV).
- **PROP-164: Sincronización Multi-Dispositivo Local (P2P / LAN)**: Compartir la partida entre un PC principal y una tablet mediante WebSockets en la red local.
- **PROP-165: Sistema de Migración Automática de Esquemas con Versionado**: Scripts deterministas que actualicen estructuras antiguas de datos a nuevas versiones sin romper fichas existentes.
- **PROP-166: Exportación de Campaña en Paquete Autónomo (`.tavernworld`)**: Archivo comprimido ZIP que contenga el mundo, mapas, personajes, historial de chat y estado del grupo.
- **PROP-167: Papelera de Reciclaje con Recuperación Temporal**: Retener personajes y chats eliminados durante 30 días antes de su purga definitiva del disco.
- **PROP-168: Detección y Reparación de Archivos JSONL Dañados**: Utilidad integrada en el arranque que repare automáticamente líneas truncadas o caracteres nulos.
- **PROP-169: Almacenamiento en Caché de Assets Multimedia con Hash Criptográfico**: Guardar mapas e imágenes con nombres basados en su contenido SHA-256 para evitar duplicaciones.
- **PROP-170: Bloqueo Transaccional por Conversación**: Evitar que dos peticiones asíncronas escriban simultáneamente en el mismo archivo mediante cerrojos en memoria.
- **PROP-171: Sincronización Bidireccional con Bóvedas de Obsidian**: Exportar e importar automáticamente notas de campaña, PNJs y lore hacia una carpeta compatible con Obsidian.
- **PROP-172: Purga Inteligente de Respuestas Alternativas (Swipes) Antiguas**: Comprimir o descartar swipes de mensajes antiguos para reducir el peso de los archivos JSONL.
- **PROP-173: Persistencia de Historiales de Tiradas de Dados**: Registro histórico de todas las tiradas de dados efectuadas en la campaña con marcas de tiempo.
- **PROP-174: Copias de Seguridad Incrementales Cada N Minutos**: Guardar instantáneas delta en segundo plano para minimizar pérdidas en caso de apagón.
- **PROP-175: Optimización de Almacenamiento en Tarjetas PNG**: Emplear compresión Oxipng / Pngquant para reducir el tamaño de las tarjetas de personaje sin degradar calidad.
- **PROP-176: Monitor de Salud del Sistema de Archivos**: Alerta en la interfaz si el disco duro tiene menos del 5% de espacio disponible.
- **PROP-177: Soporte para Múltiples Carpetas de Datos (Multi-Vault)**: Permitir alternar entre distintas carpetas raíz de datos desde el menú de ajustes.
- **PROP-178: Indexación en Segundo Plano de Mensajes para Búsqueda Global**: Crear un índice FTS (Full-Text Search) rápido para encontrar cualquier mención histórica en segundos.
- **PROP-179: Exportación de Estadísticas de la Campaña en Formato CSV / Excel**: Tabla de progreso del grupo con XP acumulada, oro ganado y enemigos derrotados.
- **PROP-180: Verificación de Integridad de Enlaces en Lorebooks**: Reportar qué entradas de World Info hacen referencia a mapas o imágenes que ya no existen en disco.

---

## Área 10: Ecosistema de Extensiones, DevOps & Testing (PROP-181 a PROP-200)

- **PROP-181: Suite Completa de Tests Unitarios con Jest para Reglas D&D**: Cobertura al 100% de cálculos de modificadores, AC, capacidades de carga y consumibles.
- **PROP-182: Tests End-to-End (E2E) con Playwright**: Pruebas automáticas de navegación: abrir grupo, equipar un arma, mover un token en el mapa y enviar un mensaje.
- **PROP-183: SDK Formal para Desarrolladores de Extensiones**: Publicar `@sillytavern/sdk` con tipos TypeScript y métodos oficiales para evitar parches al código del núcleo.
- **PROP-184: Pipeline de Integración Continua (CI) en GitHub Actions**: Ejecutar linter, formateador Prettier y tests unitarios en cada Pull Request.
- **PROP-185: Contenedor Docker Multi-Etapa (Multi-Stage Build)**: Imagen Docker ligera y segura de menos de 150 MB basada en Alpine Linux.
- **PROP-186: Entorno de Desarrollo Aislado con DevContainers**: Configuración `.devcontainer/` para arrancar en VS Code con todas las herramientas preinstaladas.
- **PROP-187: Marketplace Comunitario de Módulos y Campañas**: Repositorio centralizado dentro de la UI para instalar campañas, monstruos y mapas en un clic.
- **PROP-188: Hooks de Pre-commit con Husky**: Bloquear commits que no superen las reglas de ESLint o que contengan claves de API en el código fuente.
- **PROP-189: Generador Automático de Documentación de API con TypeDoc**: Compilar automáticamente la documentación técnica de todos los módulos en cada versión.
- **PROP-190: Telemetría de Errores Local y Anónima**: Registro estructurado de caídas y excepciones en `error.log` para facilitar el soporte técnico.
- **PROP-191: Servidor Mock de LLM para Desarrollo sin Consumo de API**: Servidor simulado local que responda con tokens sintéticos para programar sin gastar saldo.
- **PROP-192: Soporte para Hot Reload en Módulos de Frontend**: Recargar módulos JS modificados sin refrescar la página completa del navegador.
- **PROP-193: Despliegue con un Solo Clic en Servicios Cloud (Render, Railway)**: Botones "Deploy to Cloud" con variables de entorno preconfiguradas.
- **PROP-194: Verificación de Tipos Automática en CI (`tsc --noEmit`)**: Comprobar la coherencia estática del código en cada integración.
- **PROP-195: Herramienta de Benchmarking de Tokens**: Script de pruebas que mida la velocidad de procesamiento de promts y renderizado de texto.
- **PROP-196: Guía Oficial de Contribución para el Motor RPG**: Documentar las convenciones de nombres y estándares para creadores de contenido de rol.
- **PROP-197: Plantilla de Creación de Nuevas Extensiones**: Generador CLI (`npm run create-extension`) con boilerplate listo para programar.
- **PROP-198: Pruebas de Carga para Modo Multi-Usuario**: Scripts de estrés con K6 que simulen 50 usuarios simultáneos en el servidor Express.
- **PROP-199: Compatibilidad Garantizada con Node.js 22 LTS y 24**: Pruebas continuas en las versiones más modernas de Node.js.
- **PROP-200: Canal de Actualizaciones Automáticas dentro de la Aplicación**: Notificación de nuevas versiones del fork con registro de cambios (changelog) visual y botón de actualización asistida.

---

## Enlaces Relacionados
- [[HOME]]: Portal principal de la Wiki.
- [[PROBLEMAS_TECNICOS]]: Diagnóstico detallado que motiva muchas de estas propuestas.
- [[Guia-Desarrollo-Flujo]]: Pautas para implementar estas mejoras en el flujo de trabajo.
