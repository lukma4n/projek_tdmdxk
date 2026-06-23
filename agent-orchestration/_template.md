---
task: [nama-task]
branch: [nama-branch]
status: planning
created: YYYY-MM-DD
---

# [Nama Fitur / Task]

## Context
[Mengapa task ini ada — masalah apa yang diselesaikan, apa hasil yang diharapkan]

## Executor Context
- Branch aktif: `[branch]`
- Constraint kritis: [isi atau "tidak ada"]
- Verification wajib setelah selesai:
  ```bash
  cd api && npx prisma validate
  cd api && npm test
  cd web && npm run lint && npm run build
  curl http://localhost:3001/health
  ```

## Task Breakdown

### Task 1: [Nama]
- **Scope**: [apa yang dikerjakan executor untuk task ini]
- **Files**: [file yang disentuh]
- **Depends on**: none

### Task 2: [Nama]
- **Scope**: [...]
- **Files**: [...]
- **Depends on**: Task 1

---

## Results

### Task 1 — pending
```
Files changed: -
Tests: -
Blockers: -
```

### Task 2 — pending
```
Files changed: -
Tests: -
Blockers: -
```
