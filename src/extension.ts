import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  try {
    // CRITICAL: Log to Developer Tools console FIRST (before anything else)
    console.log('======================================');
    console.log('PHOENIX LSP ACTIVATION STARTED');
    console.log('======================================');

    const outputChannel = vscode.window.createOutputChannel('Phoenix Pulse');
    console.log('Output channel created');

    outputChannel.appendLine('Phoenix Pulse extension activating...');
    console.log('Phoenix Pulse extension is now active!');

    try {
    // Path to the language server module
    const serverModule = context.asAbsolutePath(
      path.join('lsp', 'dist', 'server.js')
    );

    outputChannel.appendLine(`LSP server module path: ${serverModule}`);
    console.log(`LSP server module path: ${serverModule}`);

    // Check if server module exists
    const fs = require('fs');
    if (!fs.existsSync(serverModule)) {
      const errorMsg = `ERROR: LSP server module not found at ${serverModule}`;
      outputChannel.appendLine(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
      return;
    }

    // Server options - run the LSP server using Node.js IPC
    const serverOptions: ServerOptions = {
      run: { module: serverModule, transport: TransportKind.ipc },
      debug: {
        module: serverModule,
        transport: TransportKind.ipc,
        options: { execArgv: ['--nolazy', '--inspect=6009'] }
      }
    };

    // Client options - configure which files the LSP should handle
    const clientOptions: LanguageClientOptions = {
      // Register the server for HEEx and Elixir files (with pattern fallbacks)
      documentSelector: [
        { scheme: 'file', language: 'phoenix-heex' },
        { scheme: 'file', language: 'elixir' },
        { scheme: 'file', pattern: '**/*.heex' },  // Fallback for .heex files
        { scheme: 'file', pattern: '**/*.ex' },    // Fallback for .ex files
        { scheme: 'file', pattern: '**/*.exs' }    // Fallback for .exs files
      ],
      synchronize: {
        // Notify the server about file changes to .ex, .exs, and .heex files
        fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{ex,exs,heex}')
      },
      outputChannel: outputChannel
    };

    // Create the language client and start it
    client = new LanguageClient(
      'phoenixLSP',
      'Phoenix Pulse',
      serverOptions,
      clientOptions
    );

    // Handle client errors
    client.onDidChangeState((event) => {
      outputChannel.appendLine(`LSP State changed: ${JSON.stringify(event)}`);
    });

    // Start the client (this will also launch the server)
    outputChannel.appendLine('Starting Phoenix Pulse LSP client...');
    client.start().then(() => {
      outputChannel.appendLine('Phoenix Pulse LSP client started successfully!');
      vscode.window.showInformationMessage('Phoenix Pulse is now active!');
    }).catch((error) => {
      const errorMsg = `Failed to start Phoenix Pulse LSP client: ${error}`;
      outputChannel.appendLine(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
    });

    console.log('Phoenix LiveView LSP client started');
    } catch (error) {
      const errorMsg = `Error activating Phoenix Pulse: ${error}`;
      outputChannel.appendLine(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
      console.error('INNER ERROR:', error);
    }
  } catch (topError) {
    // Top-level catch - even if outputChannel fails
    console.error('======================================');
    console.error('CRITICAL ERROR IN PHOENIX LSP ACTIVATION');
    console.error(topError);
    console.error('======================================');
    vscode.window.showErrorMessage(`Phoenix Pulse activation failed: ${topError}`);
  }
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  console.log('Stopping Phoenix Pulse LSP client');
  return client.stop();
}
