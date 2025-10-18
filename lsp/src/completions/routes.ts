import { CompletionItem, CompletionItemKind, TextEdit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { RouterRegistry } from '../router-registry';

export function getVerifiedRouteCompletions(
  document: TextDocument,
  position: { line: number; character: number },
  linePrefix: string,
  routerRegistry: RouterRegistry
): CompletionItem[] | null {
  const match = /~p\"([^"]*)$/.exec(linePrefix);
  if (!match) {
    return null;
  }

  const partial = match[1];
  const routes = routerRegistry.getRoutes();
  if (routes.length === 0) {
    return null;
  }

  const startCharacter = position.character - partial.length;
  const range = {
    start: { line: position.line, character: startCharacter },
    end: position,
  };

  return routes
    .filter(route => route.path.startsWith('/') && route.path.startsWith(partial, 0))
    .map((route, index) => ({
      label: route.path,
      kind: CompletionItemKind.Value,
      detail: `${route.verb} ${route.path}`,
      documentation: `Route defined in ${route.filePath.split('/').pop()} (line ${route.line})`,
      textEdit: TextEdit.replace(range, route.path),
      sortText: `0${index.toString().padStart(3, '0')}`,
    }));
}
