module.exports = {
  apps: [
    {
      name: 'dxk-api',
      cwd: './api',
      script: 'src/app.js',
      // instances: 1 — rate limiter pakai store in-memory (per-proses). Dengan >1
      // worker, limit login/brute-force jadi tidak konsisten (terbagi antar proses).
      // App juga pakai SQLite (single writer) + Redis opsional, jadi 1 instance
      // adalah pilihan tepat untuk deployment single-site. Naikkan hanya bila rate
      // limiter dipindah ke store bersama (Redis) — lihat docs/rencana_perbaikan.md.
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '500M',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000
    }
  ]
};
