# Agent Orchestration

Folder ini adalah jalur komunikasi antara **Planner Agent** dan **Executor Agent** di proyek DXK.

## Struktur

```
agent-orchestration/
├── README.md        ← panduan ini
├── _template.md     ← template kosong untuk task baru
└── [nama-task].md   ← satu file per fitur/task (dibuat saat ada pekerjaan)
```

## Alur Kerja

### Planner (main agent)

1. Copy `_template.md` → beri nama sesuai fitur, misal `pickup-export.md`
2. Isi bagian **Context**, **Executor Context**, dan **Task Breakdown**
3. Set frontmatter `status: ready`
4. `TaskCreate` per sub-task → catat `taskId`
5. Spawn executor:

   ```
   Agent(prompt="Baca agent-orchestration/[nama].md. Kerjakan Task N. Tulis hasil di Results → Task N.")
   ```

6. Setelah executor selesai → `TaskUpdate(taskId, done)` → ubah status task di file menjadi `done`

### Executor (sub-agent)

1. Baca file task yang dirujuk di prompt
2. Baca bagian **Executor Context** — pahami constraint dan perintah verifikasi
3. Kerjakan HANYA scope task yang ditugaskan
4. Jalankan verification wajib setelah selesai
5. Tulis hasil ke bagian **Results** di file yang sama
6. Return ringkasan ke planner

## Aturan

- Executor **tidak boleh** menyentuh file di luar scope task yang ditugaskan
- Jika ada blocker → hentikan, tulis di `Results → Blockers`, jangan tebak-tebak
- Planner yang memutuskan apakah task selanjutnya dijalankan seri atau paralel
- File task lama yang sudah `done` boleh dibiarkan sebagai arsip
