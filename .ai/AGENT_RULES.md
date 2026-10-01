# Worker rules

- Follow the assigned task and existing architecture; inspect only relevant files and direct dependencies. Do not redesign systems or silently alter architectural decisions.
- Edit only assigned files. Shared checkout: do not revert other work, change stable checkout/install/profile, or commit/push unless assigned.
- Reuse established patterns; avoid speculative abstractions and dependencies. Favor readable, debuggable feature modules over large coordinators.
- Preserve personal data and cancellation/complete-snapshot contracts. Never expose real credentials or inspect unrelated browser/provider sessions. Use synthetic credentials and isolated QA profiles.
- Run task verification; report exact commands, results and limitations. Passing fixtures are not real provider or Windows certification.
- Report summary, changed files, tests/checks, result, unresolved issues and architectural concerns. Keep reports concise.
- Default worker: Luna Max. Escalation: clarify scope/context first, then Sol Low only for demonstrated complexity; architecture/global decisions return to orchestrator.
