const colors = require('colors/safe');

function displayWelcomeMessage() {
  console.log('\n');
  console.log(colors.cyan('='.repeat(80)));
  console.log(colors.cyan('=') + ' ' + colors.bold.white('DERIBIT TRADING SYSTEM') + ' '.repeat(59) + colors.cyan('='));
  console.log(colors.cyan('=') + ' ' + colors.white('High-Performance Order Execution and Management') + ' '.repeat(33) + colors.cyan('='));
  console.log(colors.cyan('='.repeat(80)));
  console.log(colors.cyan('=') + ' ' + colors.yellow('Server Status:') + ' ' + colors.green('Starting') + ' '.repeat(61) + colors.cyan('='));
  console.log(colors.cyan('=') + ' ' + colors.yellow('API Target:') + ' ' + colors.green('Deribit Test') + ' '.repeat(60) + colors.cyan('='));
  console.log(colors.cyan('=') + ' ' + colors.yellow('WebSocket:') + ' ' + colors.green(`ws://localhost:${process.env.WS_PORT || 8080}`) + ' '.repeat(51) + colors.cyan('='));
  console.log(colors.cyan('='.repeat(80)));
  console.log('\n');
}

module.exports = {
  displayWelcomeMessage
};