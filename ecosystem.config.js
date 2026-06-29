module.exports = {
  apps: [
    {
      name: 'resisen-api',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads', '.git'],
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8082,
      },
      error_file: '/var/www/resisen.ispeed.pro/logs/error.log',
      out_file: '/var/www/resisen.ispeed.pro/logs/combined.log',
      log_file: '/var/www/resisen.ispeed.pro/logs/combined.log',
      time: true,
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,
    },
  ],
};
