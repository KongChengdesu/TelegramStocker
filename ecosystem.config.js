const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

function calcPath(relativePath) {
  return path.join(__dirname, relativePath);
}

const getEnvVariables = () => {
    const envConfig = dotenv.parse(fs.readFileSync(calcPath('.env')));
  
    const requiredEnvVariables = ['MODE'];
  
    for (envVariable of requiredEnvVariables) {
      if (!envConfig[envVariable]) {
        throw new Error(`Environment variable "${envVariable}" is not set`);
      }
    }
  
    return envConfig;
};

module.exports = {
    apps : [{
      name      : 'TelegramStocker',
      script    : 'node index.js',
      node_args : '-r dotenv/config',
      env: getEnvVariables(),
    }],
  }