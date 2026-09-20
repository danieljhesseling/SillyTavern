---
title: Conectores de IA & Proveedores Soportados
tags: [ia, llm, openai, claude, gemini, kobold, openrouter, samplers, tokenizers]
created: 2026-09-20
author: DanielJHesseling / Antigravity AI
---

# Conectores de IA & Proveedores Soportados

SillyTavern actúa como un hub universal de inferencia agnóstico al modelo, capaz de comunicarse tanto con APIs comerciales en la nube como con motores de ejecución local en hardware propio. Este documento detalla los conectores disponibles, sus rutas de backend correspondientes, los tokenizadores y los parámetros de muestreo (samplers).

---

## 1. Catálogo de Proveedores y Endpoints Backend

Cada proveedor de IA se implementa mediante un router modular en `src/endpoints/` para encapsular la autenticación, reintento de peticiones y transformación de formatos:

| Proveedor | Archivo de Backend | Endpoint REST | Características Principales |
| :--- | :--- | :--- | :--- |
| **OpenAI** | `src/endpoints/openai.js` | `/api/openai/*` | Modelos GPT-4o, GPT-4 Turbo, o1; soporte nativo de visión y function calling. |
| **Anthropic** | `src/endpoints/anthropic.js` | `/api/anthropic/*` | Claude 3.5 Sonnet, Opus, Haiku; ventanas de contexto de 200k tokens y prefill. |
| **Google Gemini** | `src/endpoints/google.js` | `/api/google/*` | Gemini 1.5 Pro / Flash, Gemini 2.0; ventanas masivas (1M+ tokens), multimodalidad. |
| **KoboldAI / KoboldCpp**| `src/endpoints/backends/kobold.js` | `/api/backends/kobold/*` | Modelos GGUF locales sin censura; baja latencia, cuantización k-quants, gramáticas BNF. |
| **Chat Completions Genérico** | `src/endpoints/backends/chat-completions.js` | `/api/backends/chat-completions/*` | Compatible con Ollama, vLLM, Aphrodite Engine, LM Studio, TabbyAPI y LocalAI. |
| **OpenRouter** | `src/endpoints/openrouter.js` | `/api/openrouter/*` | Pasarela unificada con acceso a cientos de modelos abiertos y cerrados; ranking de precios. |
| **NovelAI** | `src/endpoints/novelai.js` | `/api/novelai/*` | Modelos Kayra y Clio; sesgo especializado en ficción interactiva y narrativa literaria. |
| **AI Horde** | `src/endpoints/horde.js` | `/api/horde/*` | Red distribuida de computación colaborativa (GPUs de voluntarios); no requiere hardware local. |
| **Azure OpenAI** | `src/endpoints/azure.js` | `/api/azure/*` | Despliegues corporativos de OpenAI sobre infraestructura de Microsoft Azure. |
| **MiniMax & VolcEngine** | `src/endpoints/minimax.js`, `volcengine.js` | `/api/minimax/*`, `/api/volcengine/*` | Modelos de alto rendimiento y bajo costo en el mercado asiático (ej. Doubao). |

---

## 2. Parámetros de Muestreo (Samplers)

SillyTavern permite un control quirúrgico sobre la probabilidad de selección de tokens mediante su panel de configuración (`public/scripts/textgen-settings.js`):

- **Temperature (Temperatura)**: Escala la aleatoriedad de la distribución de probabilidades. Valores más bajos producen respuestas deterministas; valores más altos aumentan la creatividad.
- **Top-P (Nucleus Sampling)**: Limita la selección al subconjunto acumulado de tokens cuya probabilidad combinada alcance el umbral $P$ (típicamente 0.90 o 0.95).
- **Top-K**: Filtra los $K$ tokens más probables antes del cálculo de softmax.
- **Min-P**: Filtro alternativo dinámico que descarta cualquier token cuya probabilidad sea inferior al porcentaje configurado relativo al token más probable (ej. `0.05` del token superior). Muy efectivo para evitar alucinaciones en modelos modernos.
- **Repetition Penalty & Frequency/Presence Penalty**: Penaliza la repetición de palabras o conceptos ya mencionados en la conversación.
- **Mirostat**: Algoritmo de control activo de entropía que estabiliza la coherencia en chats extensos (`tau` y `eta`).
- **CFG Scale (Classifier-Free Guidance)**: Permite contrastar la generación guiada con una generación negativa o neutra para forzar la fidelidad al estilo narrativo.

---

## 3. Tokenizadores Locales y Control de Ventana de Contexto

Para evitar que el prompt exceda el límite del modelo y provoque errores `400 Bad Request: Context length exceeded`, SillyTavern realiza el recuento de tokens de manera local en el cliente antes de emitir la petición:

- **OpenAI BPE**: Utiliza `@dqbd/tiktoken` compilado a WebAssembly en el navegador (`cl100k_base` para GPT-4/3.5, `o200k_base` para GPT-4o).
- **SentencePiece & HuggingFace Tokenizers**: Emplea `@agnai/sentencepiece-js` y `@agnai/web-tokenizers` para procesar vocabularios de modelos Llama, Mistral, Gemma y Yi.
- **Anthropic Tokenizer**: Algoritmo de estimación precisa para la familia Claude.

> [!NOTE]
> Cuando el Dynamic Context Manager (`dynamic-context-manager.js`) evalúa las instrucciones D&D, utiliza `getTokenCountAsync()` (`tokenizers.js`) para garantizar que el bloque inyectado no rebase el `tokenBudget` asignado para la campaña.

---

## 4. Capacidades Multimodales

1. **Visión (Image Understanding)**:
   - El usuario puede arrastrar imágenes al área de chat o pegar capturas del portapapeles.
   - Si el backend seleccionado soporta visión (GPT-4o, Claude 3.5, Gemini 1.5, o modelos LLaVA locales), la imagen se procesa en base64 o URL efímera y se inyecta en el payload multimodal del mensaje.
2. **Generación de Voz (Text-to-Speech - TTS)**:
   - Integrado en `src/endpoints/speech.js`.
   - Conexión con ElevenLabs, Silero, Coqui, AllTalk TTS, Azure Speech y Web Speech API del navegador para reproducir la voz de los personajes.
3. **Generación de Imágenes**:
   - Integrado en `src/endpoints/stable-diffusion.js`.
   - Soporte para AUTOMATIC1111 WebUI, ComfyUI, Forge y Horde para ilustrar escenas o retratos durante el juego.

---

## 5. Enlaces Relacionados
- [[Ciclo-De-Vida-Prompt]]: Cómo viajan los mensajes hacia estos conectores.
- [[Dynamic-Context-Manager]]: Integración del presupuesto de tokens con los modelos.
- [[Seguridad-Autenticacion]]: Almacenamiento seguro de credenciales en `secrets.json`.
- [[PROPUESTAS_MEJORA]]: Propuestas de soporte para Function Calling estructurado y nuevos modelos.
