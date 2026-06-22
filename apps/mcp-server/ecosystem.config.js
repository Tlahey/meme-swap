module.exports = {
  apps: [
    {
      name: 'mcp-server',
      script: 'build/index.js',
      cwd: './apps/mcp-server',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './logs/mcp-server-error.log',
      out_file: './logs/mcp-server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
