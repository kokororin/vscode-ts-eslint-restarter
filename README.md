# TS/ESLint Server Restarter

The TypeScript Language Server and ESlint server becomes slow over long period of usage and sometimes gets stuck when changing files outside of VS Code (eg. changing git branches).

This extension adds a convenient _Restart TS_, _Restart ESLint_ and _Restart Both_ button to the Status Bar which allows you to quickly restart them, a _Restart TS/ESLint Server_ command to the command palette (Ctrl + Shift + p)

Additionally, the extension provides an automatic restart feature for ESLint when memory usage reaches a certain threshold.

![Button preview](images/buttons.png)

![Command Palette preview](images/commandPalette.png)

Inspired by the [Restart TS and ESLint server](https://github.com/acoreyj/vscode-restart-ts-eslint) extension, which does not have the automatic restart feature.
Inspired by the [Restart Your TS Server](https://github.com/HearTao/restart-your-ts-server) extension, which does the same for touch bars.
Inspired by the [Restart TS server Status Bar button](https://github.com/qcz/vscode-restart-ts-server-button) extension

## License

MIT
