const root = process.env.CRM_ROOT || '/opt/crm-system';

export default {
  apps: [
    {
      name: 'crm-stable',
      cwd: root,
      script: 'node_modules/next/dist/bin/next',
      args: 'start --hostname 127.0.0.1 --port 3000',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      env: {
        NODE_ENV: 'production',
        CRM_PROFILE: 'stable',
        PORT: '3000',
      },
      error_file: `${root}/logs/stable/pm2-error.log`,
      out_file: `${root}/logs/stable/pm2-out.log`,
      merge_logs: true,
      time: true,
    },
    {
      name: 'crm-test',
      cwd: root,
      script: 'node_modules/next/dist/bin/next',
      args: 'start --hostname 127.0.0.1 --port 3001',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      env: {
        NODE_ENV: 'production',
        CRM_PROFILE: 'test',
        PORT: '3001',
      },
      error_file: `${root}/logs/test/pm2-error.log`,
      out_file: `${root}/logs/test/pm2-out.log`,
      merge_logs: true,
      time: true,
    },
  ],
};
