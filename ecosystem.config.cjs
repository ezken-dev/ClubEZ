module.exports = {
  apps: [
    {
      name: 'club-ezken-bot',
      script: 'npx',
      args: 'tsx server.ts',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true
    }
  ]
};
