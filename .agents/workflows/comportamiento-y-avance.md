---
description: Inicializa el contexto agéntico leyendo las directivas de comportamiento y sincroniza el estado actual del proyecto desde la hoja de ruta para reanudar el desarrollo de forma precisa.
---

# Workflow: comportamiento-y-avance
## Trigger: On-Demand / Workspace-Init

### Context Gathering
1. **System Behavior Alignment:**
   - Scan and read all configuration files located within the `.agents/` directory.
   - Adopt the roles, constraints, and operational guidelines defined in those files as system-level instructions for the current session.

2. **Project Roadmap Retrieval:**
   - Locate and parse the `Informe de avance/` directory.
   - Read the roadmap and the current status files to identify the last completed milestone, active bottlenecks, and pending objectives.

### Execution Plan
- Synthesize the behavior rules with the project's current state.
- Output a brief summary in the console acknowledging:
  - Active persona/behavior profile loaded.
  - Last achieved milestone detected.
  - Next immediate technical objective to execute.
- Await user confirmation or transition to the next development sub-agent.