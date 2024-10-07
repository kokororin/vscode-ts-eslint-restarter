import * as vscode from 'vscode';
import { CronJob } from 'cron';
import pidtree from 'pidtree';
import getProcesses from 'getprocesses';
import pidusage from 'pidusage';
import { DateTime } from 'luxon';

let restartTsEslintTs: vscode.StatusBarItem;
let restartTsEslintEslint: vscode.StatusBarItem;
let restartTsEslintBoth: vscode.StatusBarItem;
let cronJob: CronJob;
let cronStartTime: DateTime;
let eslintMaxMemory: number;

const TYPESCRIPT_EXTENSION_ID = 'vscode.typescript-language-features';
const ESLINT_EXTENSION_ID = 'dbaeumer.vscode-eslint';

const RESTART_TS_SERVER_LABEL = '$(debug-restart) Restart TS';
const RESTART_ESLINT_SERVER_LABEL = '$(debug-restart) Restart ESLint';
const RESTART_BOTH_LABEL = '$(debug-restart) Restart Both';
const THIS_EXT_NAME = 'ts-eslint-restarter';
const THIS_EXT_ID = `kokororin.${THIS_EXT_NAME}`;
const SUPPORTED_LANGUAGES = [
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
  'svelte'
];

export async function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      `${THIS_EXT_NAME}.softRestartTsServer`,
      softRestartTsServer
    ),
    vscode.commands.registerCommand(
      `${THIS_EXT_NAME}.softRestartEslintServer`,
      softRestartEslintServer
    ),
    vscode.commands.registerCommand(
      `${THIS_EXT_NAME}.softRestartBoth`,
      softRestartBoth
    )
  );

  restartTsEslintTs = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    1
  );
  restartTsEslintTs.command = `${THIS_EXT_NAME}.softRestartTsServer`;
  restartTsEslintTs.text = RESTART_TS_SERVER_LABEL;

  restartTsEslintEslint = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    1
  );
  restartTsEslintEslint.command = `${THIS_EXT_NAME}.softRestartEslintServer`;
  restartTsEslintEslint.text = RESTART_ESLINT_SERVER_LABEL;

  restartTsEslintBoth = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    0
  );
  restartTsEslintBoth.command = `${THIS_EXT_NAME}.softRestartBoth`;
  restartTsEslintBoth.text = RESTART_BOTH_LABEL;

  const restartBothCommandPalette = vscode.commands.registerCommand(
    `${THIS_EXT_NAME}.softRestartBothCommand`,
    softRestartBoth
  );

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
  context.subscriptions.push(restartBothCommandPalette);

  updateStatusBarItemVisibility();
  loadSettings();
  startCron();
  console.log(`Extension ${THIS_EXT_ID} is now active!`);
}

function softRestartEslintServer() {
  const eslintExtension = vscode.extensions.getExtension(ESLINT_EXTENSION_ID);
  if (!eslintExtension || eslintExtension.isActive === false) {
    vscode.window.showErrorMessage(
      'ESLint extension is not active or not running.'
    );
    return;
  }

  return vscode.commands.executeCommand('eslint.restart');
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
    restartTsEslintTs.hide();
    restartTsEslintEslint.hide();
    restartTsEslintBoth.hide();
  } else {
    restartTsEslintTs.show();
    const eslintExtension = vscode.extensions.getExtension(ESLINT_EXTENSION_ID);
    if (eslintExtension && eslintExtension.isActive !== false) {
      restartTsEslintEslint.show();
      restartTsEslintBoth.show();
    }
  }
}

function loadSettings() {
  eslintMaxMemory = vscode.workspace
    .getConfiguration(THIS_EXT_NAME)
    .get<number>('eslintMaxMemory', 3072);
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
    console.log(
      `Memory usage of eslint server is over ${eslintMaxMemory} MB (${memMb} MB).`
    );
    await softRestartEslintServer();
  }
}

// this method is called when your extension is deactivated
export function deactivate() {
  stopCron();
  console.log(`Extension ${THIS_EXT_ID} is now inactive!`);
}
