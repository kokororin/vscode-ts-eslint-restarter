import pkg from '../package.json';

export const TYPESCRIPT_EXTENSION_ID = 'vscode.typescript-language-features';
export const ESLINT_EXTENSION_ID = 'dbaeumer.vscode-eslint';

export const RESTART_LABEL = `$(debug-restart) ${pkg.displayName}`;
export const THIS_EXT_NAME = pkg.name;
export const THIS_EXT_ID = `${pkg.publisher}.${THIS_EXT_NAME}`;
export const SUPPORTED_LANGUAGES = [
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
  'svelte'
];
