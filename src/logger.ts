import * as vscode from 'vscode';
import winston from 'winston';
import { LogOutputChannelTransport } from 'winston-transport-vscode';
import pkg from '../package.json';

const outputChannel = vscode.window.createOutputChannel(pkg.displayName, {
  log: true
});

export const logger = winston.createLogger({
  level: 'trace',
  levels: LogOutputChannelTransport.config.levels,
  format: LogOutputChannelTransport.format(),
  transports: [new LogOutputChannelTransport({ outputChannel })]
});
