const path = require('path');
const Service = require('node-windows').Service;

const action = process.argv[2]; // 'install' or 'uninstall'
const serviceName = 'WinnieOS Server';
const serviceDescription = 'WinnieOS local web server';
const scriptPath = path.join(__dirname, '..', 'server.js');

// Create service object
const svc = new Service({
  name: serviceName,
  description: serviceDescription,
  script: scriptPath,
  nodeOptions: []
});

if (action === 'install') {
  // Install the service
  svc.on('install', () => {
    console.log(`${serviceName} installed successfully`);
    console.log('Starting service...');
    svc.start();
  });

  svc.on('start', () => {
    console.log(`${serviceName} started successfully`);
    process.exit(0);
  });

  svc.on('error', (err) => {
    console.error(`Service error: ${err.message}`);
    process.exit(1);
  });

  svc.install();
  // node-windows keeps the process alive during installation
} else if (action === 'uninstall') {
  // Uninstall the service (PowerShell wrapper handles stopping first)
  svc.on('uninstall', () => {
    console.log(`${serviceName} uninstalled successfully`);
    process.exit(0);
  });

  svc.on('error', (err) => {
    console.error(`Service error: ${err.message}`);
    process.exit(1);
  });

  svc.uninstall();
  // node-windows keeps the process alive during uninstallation
} else {
  console.error('Usage: node install-service.js [install|uninstall]');
  process.exit(1);
}
