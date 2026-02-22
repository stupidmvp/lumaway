# LumaWay Engine - Especificación Técnica (SDD)

Esta es la especificación técnica fundacional del Engine de LumaWay, diseñada estrictamente bajo los principios de **Spec-Driven Development (SDD)**. Esta especificación define el comportamiento esperado, las responsabilidades y los límites funcionales del Engine, estableciendo la base antes de escribir cualquier línea de código de implementación funcional.

---

## 1. Visión General del Engine

**¿Qué es?**
El Engine de LumaWay es el cerebro determinista y orquestador central del sistema. Su propósito es procesar una corriente de eventos (interacciones del usuario, navegación, intenciones explícitas) junto con el estado de ejecución actual, para emitir decisiones estructuradas sobre cómo guiar al usuario a través de un *walkthrough* predefinido y validado, alojado en el CMS. Opera bajo un modelo de acompañamiento no invasivo, evaluando en tiempo real si el usuario necesita intervención, corrección, o si el Engine debe mantenerse en silencio.

**¿Qué NO es?**
- No es un generador de interfaces de usuario (UI) ni renderizador.
- No es una herramienta de scraping o automatización oculta del DOM.
- No es un LLM autónomo de propósito general; no "inventa" flujos ni pasos.
- No es un sistema de control que bloquea o fuerza la navegación del usuario. No toma el control del cursor.

**¿Qué problemas resuelve?**
- **Sincronización de Contexto:** Determina de manera asertiva en qué punto exacto de un proceso de negocio se encuentra el usuario.
- **Resolución de Ambigüedad:** Distingue cognitivamente entre exploración válida del usuario, una desviación del flujo esperado, y fricción real.
- **Intervención Basada en Valor:** Mitiga la fatiga del usuario evitando el "ruido", decidiendo intervenir u orientar solo cuando aporta un valor claro al usuario para alcanzar su meta.

---

## 2. Arquitectura del Agent Team

El Engine **NO** opera como un ente monolítico omnisciente. Funciona como un equipo de agentes (Agent Team) sumamente especializados. Cada agente tiene un dominio estricto, una responsabilidad inmutable, consumiendo entradas acotadas y emitiendo salidas estructuradas para el siguiente eslabón, evitando la alucinación global.

### Agentes del Sistema

1. **Agente de Interpretación de Intención (Intent Interpreter)**
   - **Responsabilidad:** Analizar eventos de interacción sin procesar, intenciones explícitas (ej. texto de chat) y señales del host para determinar y normalizar la macro-intención actual del usuario.
   - **Input:** Eventos de usuario, historial reciente de interacciones.
   - **Output:** Intención estructurada o Categoría Semántica (ej., `Buscar_Configuracion`, `Completar_Perfil`).

2. **Agente de Gestión de Estado de Ejecución (Execution State Manager)**
   - **Responsabilidad:** Mantener y persistir la fuente de la verdad sobre el progreso de la sesión del usuario. Registra qué *walkthroughs* y pasos se han completado y mantiene el "Cursor" del estado de la guía.
   - **Input:** Eventos validados de avance, señales de rescisión.
   - **Output:** `ExecutionState` (Walkthrough activo, paso actual cumplido, contexto local del usuario).

3. **Agente de Resolución de Walkthrough Activo (Walkthrough Resolver)**
   - **Responsabilidad:** Evaluar si la intención del usuario requiere iniciar un nuevo *walkthrough*, reanudar uno anterior, o cancelar el actual.
   - **Input:** Intención estructurada, `ExecutionState`, Catálogo indexado de Walkthroughs validados.
   - **Output:** Identificador del Walkthrough activo actual (o `null`).

4. **Agente de Resolución de Step Activo (Step Resolver)**
   - **Responsabilidad:** Dentro de la topología de un *walkthrough* vigente, inferir cuál es la meta exacta o el "paso logico" que le sigue al estado actual y que el usuario debe concretar a continuación, procesando las precondiciones estáticas.
   - **Input:** Definition del Walkthrough activo, `ExecutionState`.
   - **Output:** Estructura de requerimientos del Step Activo.

5. **Agente de Detección de Desvíos (Deviation Detector)**
   - **Responsabilidad:** Comparar y contrastar las acciones entrantes del usuario versus el "camino feliz" dictado en el *step* activo. Clasifica de manera determinista los desvíos.
   - **Input:** Eventos recientes de navegación/interacción, topología del Step activo.
   - **Output:** Vector de Desviación (`Nivel`: None/Benign/Critical, `Tipo`).

6. **Agente de Detección de Fricción / Anomalías (Friction Detector)**
   - **Responsabilidad:** Observar patrones de comportamiento en el *ExecutionState* que sugieran estancamiento o frustración (ej. tiempo excesivo sin mutación de estado, repetición cíclica de las mismas acciones, idleness profundo).
   - **Input:** Historial temporal de eventos, telemetría delta, `ExecutionState`.
   - **Output:** Nivel de fricción paramétrico (`Low`, `Medium`, `High`) y un diagnóstico crudo.

7. **Agente de Decisión de Intervención (Intervention Decider)**
   - **Responsabilidad:** **El corazón táctico del motor.** Tomar la decisión final: *¿Se enciende la guía o nos callamos?* Contrapone los inputs de fricción y desvío contra principios heurísticos estrictos, favoreciendo siempre el silencio.
   - **Input:** Output del *Deviation Detector*, Output del *Friction Detector*, `ExecutionState`.
   - **Output:** Decisión binaria de intervención (`Intervene`, `Silence`).

8. **Agente Generador de Plan de Guía (Guidance Planner)**
   - **Responsabilidad:** Exclusivamente activado si la decisión fue `Intervene`. Ensambla el esqueleto lógico de cómo debe manifestarse la ayuda hacia el exterior. Provee la acción o rumbo sugerido **sin generar texto narrativo (prosa humana)** ni inyectar UI en el host.
   - **Input:** Reglas del Step Activo, Contexto de Fricción/Desvío.
   - **Output:** Objeto agnóstico `GuidancePlan` (conteniendo `SuggestedAction`), listo para consumo del SDK frontend.

---

## 3. Flujo de Decisión

El ciclo de vida del Engine es un pipeline reactivo y puramente transaccional. Por cada ráfaga o evento significativo emitido por el host:

1. **Ingesta de Evento:** El SDK reporta hacia el Engine un evento en crudo (click semántico, cambio de route en frontend, prompt expreso).
2. **Normalización (Intent Interpreter):** El evento bruto se evalúa y clasifica.
3. **Mantenimiento del Mundo (Execution State Manager):** Si el evento denota completitud pura del paso donde ya estaba el usuario, el estado avanza.
4. **Análisis Táctico paralelo:**
   - *Deviation Detector* mide cuán lejos está la intención actual de la meta del paso validado.
   - *Friction Detector* examina métricas y ciclos inútiles.
5. **Enrutamiento (Resolvers):**
   - Si no hay contexto de Walkthrough o si la intención implica un cambio explícito de tema, el *Walkthrough Resolver* asigna uno.
   - El *Step Resolver* posiciona en la abstracción actual de pasos.
6. **Veredicto (Intervention Decider):** Puntos de inyección estrictos.
   > **Punto de Silencio A:** Usuario avanza feliz y rápido por el flujo. → *Silencio.*
   > **Punto de Silencio B:** Usuario hace cosas no esperadas pero en paths inofensivos (abrió Configuración sin cancelar el flow y regresó rápido) → *Silencio y se marca como desviación Benigna.*
   > **Punto de Acción:** Usuario presenta patrón de bucle, lanza explícitamente una duda o han concurrido varios minutos en una desviación catalogada Crítica. → *Intervención.*
7. **Emisión de Plan:** *Guidance Planner* compila el payload y el Engine termina su ciclo en fracción de milisegundos devolviendo `GuidancePlan` (o devolviendo suelta de control vacía `Silence`).

---

## 4. Modelo de Estados

El comportamiento estocástico es inadmisible; toda la gestión transaccional se resume en un `ExecutionState` máquina de estados finitos (FSM).

**Estados Base Válidos del Engine:**
- `IDLE`: Motor observando pasivamente, nada indexado en seguimiento.
- `IN_PROGRESS`: Suscripción activa a un *Walkthrough*; se está esperando o evaluando pasos.
- `SUSPENDED`: Flujo transitoriamente ignorado; el usuario hizo una desviación intencionada que no cierra el proceso actual o minimizó distracciones intencionadamente.
- `COMPLETED`: Cierre exitoso nominal de todas las operaciones requeridas de la guía actual.
- `ABORTED`: Terminal. Terminación destructiva por inconsistencia de metadatos o explicitud inconfundible de abandono emitido por el usuario.

**Transiciones Regulares y Manejo de Errores / Ambigüedad:**
- `IDLE` → `IN_PROGRESS` (Impulsado tras una clasificación de Intención o arranque explícito).
- `IN_PROGRESS` → `SUSPENDED` (Efectuado tras desvíos benignos recurrentes sin intención de cancel).
- Si en un momento dado, las entradas apuntan simultáneamente a N posibles *Walkthroughs* con alta confianza ("Ambigüedad Extrema"), el Engine no elige a ciegas; transita a ofrecer al usuario desambiguación estructurada delegando el `GuidancePlan` para que el cliente UI pida el click de confirmación.
- Ante fallo de sincronización abrupto (ej., el SDK envía eventos de un panel que lógicamente es inalcanzable temporalmente), se degrada cortésmente el state a `IDLE` y el *Execution State Manager* limpia contexto sin saturar la red (se prefiere silencio a alucinación ruidosa).

---

## 5. Límites del Sistema y Prevención de Riesgos

La arquitectura prohíbe las siguientes responsabilidades para mantener la resiliencia del framework:

> **El Engine NO domina el Client.**
> Absolutamente todo click autómata o manipulación invasiva del código del Host queda desterrado del espectro operativo del Engine. Su trabajo es estrictamente de consejo (Advisory), no de Control.

1. **Nunca bloquear:** El Engine puede manifestar un error procedural ("Oye, necesitas llenar esto para finalizar tu registro"), pero debe fallar sin impedir que el usuario opere si el usuario asume la penalidad.
2. **Nunca inventar:** Regla fundacional. Si un paso dice "Ir a B desde A", el sistema no genera pasos "Ir a C" simplemente porque en internet la gente lo hace. Depende puramente de la declaración validada inyectada desde CMS.
3. **No es escritor fantasma:** El generador se abstiene de imprimir natural language (`"¡Hola! Vi que te pediste un café..."`). El output son diccionarios planos e indicadores: `{ goal: "checkout", componentContext: "btn-pay", strategy: "tooltip" }`. La redacción final es del sistema de *Presenter/UI*.

**Delegaciones Opcionales a LLM:**
- La *Interpretación de Intención* para eventos complejos (ej. El usuario escribe en una caja de texto "quiero usar tarjetas pero no puedo") requerirá opcionalmente llamar a LLM vía adaptadores. La salida de este puente será rigurosamente un parse JSON.
- Todo circuito por fuera del Interpreter **permanecerá bajo ejecución funcional y estricta en TypeScript (o el backend nativo aplicable)**, garantizando testabilidad unitaria.

---

## 6. Alcance MVP del Engine

Este es el encuadre para la iteración inicial del desarrollo, desglosando los límites tácticos:

**In-Scope (Dentro del MVP):**
- Ingesta *Event-Driven* básica: Procesamiento de navegaciones limpias (URL changes, Page Titles) y clicks explícitos si el SDK provee *data-attributes*.
- Mecanismo determinista de `Execution State Manager` e índices.
- Operación de Agentes mediante programación imperativa / funcional (sin agentes IA estocásticos en el core para `Friction`, `Deviation`, `Walkthrough Resolvers`).
- Reglas de silencio rígidas y emisión de salidas tipo `Silence` frente a un objeto de acción `GuidancePlan` genérico.

**Out-of-Scope (Posterior al MVP):**
- Modelos complejos de telemetría o ML predictivo en `Friction Detector` (Para MVP: Fricción basada solamente en "Timeout general de paso" o "Repetición de Action n-veces").
- Desambiguación semántica impulsada en el frontend profundo (Scraping de todo el body del DOM).
- Agentes concurrentes basados en colas con latencia distribuida (La iteración inicial de la cadena operará en un pipeline síncrono rápido y de memoria de nodo, no en colas asíncronas severas como Kafka).
- A/B Testing directo empujado por Engine.
