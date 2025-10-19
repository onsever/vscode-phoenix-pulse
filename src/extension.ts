import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  DefinitionRequest
} from 'vscode-languageclient/node';

let client: LanguageClient;
let clientReady: Promise<void> = Promise.resolve();

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

      clientReady =
        typeof (client as unknown as { onReady?: () => Promise<void> }).onReady === 'function'
          ? (client as unknown as { onReady: () => Promise<void> }).onReady()
          : Promise.resolve();

      clientReady.then(() => {
        const goToDefinition = vscode.commands.registerCommand(
          'phoenixPulse.goToDefinition',
          async () => {
            if (!client) {
              vscode.window.showWarningMessage('Phoenix Pulse language server is not ready yet.');
              return;
            }

            const editor = vscode.window.activeTextEditor;
            if (!editor) {
              vscode.window.showInformationMessage('No active editor to navigate from.');
              return;
            }

            const document = editor.document;
            if (!document || document.isUntitled) {
              vscode.window.showInformationMessage('Current file must be saved before navigating.');
              return;
            }

            const filePath = document.uri.fsPath;
            if (!filePath.match(/\.(ex|exs|heex)$/i)) {
              vscode.window.showInformationMessage('Phoenix Pulse definition is only available for Elixir and HEEx files.');
              return;
            }

            const position = editor.selection.active;

            try {
              await clientReady;

              const params = client.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
              const protocolResult = await client.sendRequest(DefinitionRequest.type, params);

              if (!protocolResult) {
                vscode.window.showInformationMessage('Phoenix Pulse did not return a definition for the current position.');
                return;
              }

              outputChannel.appendLine('[Phoenix Pulse] Raw definition response received.');
              try {
                outputChannel.appendLine(JSON.stringify(protocolResult));
              } catch {
                outputChannel.appendLine('[Phoenix Pulse] Unable to stringify definition response.');
              }

              // Note: client.sendRequest() already converts protocol types to VS Code types
              // No need to call protocol2CodeConverter.asDefinitionResult()
              const definitionsRaw: Array<vscode.Location | vscode.LocationLink> = Array.isArray(protocolResult)
                ? (protocolResult as Array<vscode.Location | vscode.LocationLink>)
                : protocolResult
                ? [protocolResult as vscode.Location | vscode.LocationLink]
                : [];

              outputChannel.appendLine(`[Phoenix Pulse] Raw definitions count: ${definitionsRaw.length}`);

              const definitions = definitionsRaw
                .map((location, index) => {
                  const sanitized = sanitizeDefinition(location);
                  outputChannel.appendLine(`[Phoenix Pulse] Definition ${index} sanitized: ${sanitized ? 'valid' : 'null'}`);
                  if (sanitized) {
                    outputChannel.appendLine(`[Phoenix Pulse] Definition ${index} details: ${JSON.stringify(sanitized)}`);
                  }
                  return sanitized;
                })
                .filter((definition): definition is vscode.Location | vscode.LocationLink => !!definition);

              outputChannel.appendLine(`[Phoenix Pulse] Final definitions count: ${definitions.length}`);

              if (definitions.length === 0) {
                vscode.window.showInformationMessage('Phoenix Pulse did not return a definition for the current position.');
                return;
              }

              await vscode.commands.executeCommand(
                'editor.action.goToLocations',
                document.uri,
                position,
                definitions,
                'goto',
                'peek'
              );
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              outputChannel.appendLine(`[Phoenix Pulse] Go To Definition command failed: ${message}`);
              vscode.window.showErrorMessage('Phoenix Pulse could not navigate to the component definition. Check the Phoenix Pulse output for details.');
            }
          });

        context.subscriptions.push(goToDefinition);
      }).catch((readyError) => {
        outputChannel.appendLine(`[Phoenix Pulse] Client failed to become ready: ${readyError}`);
      });
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

function sanitizeDefinition(
  definition: vscode.Location | vscode.LocationLink
): vscode.Location | vscode.LocationLink | null {
  const candidate = definition as any;

  // Location result
  if ('uri' in candidate && 'range' in candidate) {
    const uri = sanitizeUri(candidate.uri);
    const range = sanitizeRange(candidate.range);
    if (!uri || !range) {
      return null;
    }
    return new vscode.Location(uri, range);
  }

  // LocationLink result
  if ('targetUri' in candidate) {
    const targetUri = sanitizeUri(candidate.targetUri);
    const targetSelectionRange = sanitizeRange(candidate.targetSelectionRange ?? candidate.targetRange);
    const targetRange = sanitizeRange(candidate.targetRange) ?? targetSelectionRange;
    if (!targetUri || !targetSelectionRange || !targetRange) {
      return null;
    }

    const originSelectionRange = sanitizeRange(candidate.originSelectionRange);
    return {
      originSelectionRange,
      targetUri,
      targetRange,
      targetSelectionRange,
    };
  }

  return null;
}

function sanitizeRange(range?: vscode.Range): vscode.Range | undefined {
  if (!range) {
    return undefined;
  }

  const startLine = safeNumber((range as any).start?.line);
  const startChar = safeNumber((range as any).start?.character);
  const endLine = safeNumber((range as any).end?.line, startLine);
  const endChar = safeNumber((range as any).end?.character, startChar);

  if (Number.isNaN(startLine) || Number.isNaN(endLine)) {
    return undefined;
  }

  const start = new vscode.Position(Math.max(0, startLine), Math.max(0, startChar));
  const end = new vscode.Position(Math.max(start.line, endLine), Math.max(0, endChar));
  return new vscode.Range(start, end);
}

function sanitizeUri(value: unknown): vscode.Uri | null {
  if (!value) {
    return null;
  }

  if (value instanceof vscode.Uri) {
    return value;
  }

  try {
    return vscode.Uri.parse(String(value));
  } catch {
    return null;
  }
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}
