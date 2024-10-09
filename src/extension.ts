import * as vscode from 'vscode';
import { CronJob } from 'cron';
import pidtree from 'pidtree';
import getProcesses from 'getprocesses';
import pidusage from 'pidusage';
import { DateTime } from 'luxon';
import { logger } from './logger';
import {
  THIS_EXT_NAME,
  THIS_EXT_ID,
  RESTART_LABEL,
  ESLINT_EXTENSION_ID,
  TYPESCRIPT_EXTENSION_ID,
  SUPPORTED_LANGUAGES
} from './constants';

let restartTsEslint: vscode.StatusBarItem;
let hasESLint = false;
let cronJob: CronJob;
let cronStartTime: DateTime;
let eslintMaxMemory: number;

export async function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(`${THIS_EXT_NAME}.softRestart`, softRestart)
  );

  restartTsEslint = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    1
  );
  restartTsEslint.command = `${THIS_EXT_NAME}.softRestart`;
  restartTsEslint.text = RESTART_LABEL;

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(loadSettings)
  );
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateStatusBarItemVisibility)
  );
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(updateStatusBarItemVisibility)
  );
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(updateStatusBarItemVisibility)
  );
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(updateStatusBarItemVisibility)
  );

  updateStatusBarItemVisibility();
  loadSettings();
  startCron();
  logger.info(`Extension ${THIS_EXT_ID} is now active!`);
}

async function softRestart() {
  const pickOptions = [
    'TypeScript',
    hasESLint ? 'ESLint' : '',
    hasESLint ? 'Both' : ''
  ].filter(Boolean);

  const targetResult = await vscode.window.showQuickPick(pickOptions, {
    placeHolder: 'What do you want to restart?'
  });
  if (!targetResult) {
    return;
  }
  if (targetResult === 'TypeScript') {
    await softRestartTsServer();
  } else if (targetResult === 'ESLint') {
    await softRestartEslintServer();
  } else if (targetResult === 'Both') {
    await softRestartBoth();
  }
}

async function softRestartEslintServer() {
  const eslintExtension = vscode.extensions.getExtension(ESLINT_EXTENSION_ID);
  if (!eslintExtension || eslintExtension.isActive === false) {
    vscode.window.showErrorMessage(
      'ESLint extension is not active or not running.'
    );
    return;
  }

  await vscode.commands.executeCommand('eslint.restart');
}

async function softRestartTsServer() {
  const typeScriptExtension = vscode.extensions.getExtension(
    TYPESCRIPT_EXTENSION_ID
  );
  if (!typeScriptExtension || typeScriptExtension.isActive === false) {
    vscode.window.showErrorMessage(
      'TypeScript extension is not active or not running.'
    );
    return;
  }

  await vscode.commands.executeCommand('typescript.restartTsServer');
}

async function softRestartBoth() {
  await softRestartTsServer();
  await softRestartEslintServer();
}

function updateStatusBarItemVisibility(): void {
  const { activeTextEditor } = vscode.window;

  if (
    !activeTextEditor ||
    !activeTextEditor.document ||
    SUPPORTED_LANGUAGES.indexOf(activeTextEditor.document.languageId) === -1
  ) {
    restartTsEslint.hide();
    hasESLint = false;
  } else {
    restartTsEslint.show();
    const eslintExtension = vscode.extensions.getExtension(ESLINT_EXTENSION_ID);
    if (eslintExtension && eslintExtension.isActive !== false) {
      hasESLint = true;
    }
  }
}

function loadSettings() {
  eslintMaxMemory = vscode.workspace
    .getConfiguration(THIS_EXT_NAME)
    .get<number>('eslintMaxMemory')!;
}

function startCron() {
  cronJob = new CronJob(
    '*/30 * * * * *',
    () => {
      checkEslintServer();
    },
    null,
    false
  );
  cronJob.start();
  cronStartTime = DateTime.now();
}

function stopCron() {
  if (cronJob) {
    cronJob.stop();
  }
}

async function checkEslintServer() {
  if (DateTime.now().diff(cronStartTime).as('minutes') < 3) {
    return;
  }
  if (eslintMaxMemory < 500) {
    return;
  }

  const mainPid = process.pid;
  const processes = await getProcesses();
  const childPids = await pidtree(mainPid);

  const eslintProcess = processes.find(p => {
    return (
      p.rawCommandLine.includes(ESLINT_EXTENSION_ID) &&
      childPids.includes(p.pid)
    );
  });
  if (!eslintProcess) {
    return;
  }
  const stats = await pidusage(eslintProcess.pid);
  const memMb = Math.round(stats.memory / 1024 / 1024);

  if (memMb > eslintMaxMemory) {
    logger.warn(
      `Memory usage of eslint server is over ${eslintMaxMemory} MB (${memMb} MB). Restarting...`
    );
    process.kill(eslintProcess.pid, 'SIGKILL');
  }
}

// this method is called when your extension is deactivated
export function deactivate() {
  stopCron();
  logger.info(`Extension ${THIS_EXT_ID} is now inactive!`);
}
