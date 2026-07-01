---
description: Realiza un cierre ordenado de la sesión de desarrollo actual, documentando el estado intermedio del código y sincronizando los avances en el repositorio remoto.
---

# Workflow: freno-y-reporte
## Trigger: On-Demand / Programmatic-Call

### Graceful Shutdown Sequence
1. **Task Interruption:**
   - Halt any non-critical running processes or continuous compilation loops in the sandbox environment.
   - Ensure the current codebase changes are syntactically stable, even if incomplete.

2. **State Documentation:**
   - Open the file `Informe de avance/estado_actual.md`.
   - Update the file with a comprehensive hand-off report detailing:
     - Specific files modified during the session.
     - Precise line/functional logic where the implementation stopped.
     - Known pending issues or immediate next steps required for the next agent model to resume seamlessly.

3. **Version Control Synchronization:**
   - Stage all relevant changes in the workspace (`git add .`).
   - Commit the progress with a standardized message: `docs(agent): partial progress handover - session structured pause`.
   - Push the branch to the upstream remote repository on GitHub (`git push origin <current-branch>`).

4. **Session Termination:**
   - Print a final summary of the hand-off report and safely disconnect.