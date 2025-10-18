import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PerfTimer, time } from './utils/perf';

export interface RouteInfo {
  path: string;
  verb: string;
  filePath: string;
  line: number;
}

export class RouterRegistry {
  private routes: RouteInfo[] = [];
  private workspaceRoot = '';
  private fileHashes = new Map<string, string>();

  setWorkspaceRoot(root: string) {
    this.workspaceRoot = root;
  }

  getRoutes(): RouteInfo[] {
    return this.routes;
  }

  private parseFile(filePath: string, content: string): RouteInfo[] {
    const timer = new PerfTimer('router.parseFile');
    const lines = content.split('\n');
    const routes: RouteInfo[] = [];
    const routePattern = /^\s*(get|post|put|patch|delete|options|head|live|forward)\s+"([^"]+)"/;
    const resourcesPattern = /^\s*resources\s+"([^"]+)"/;

    lines.forEach((line, index) => {
      const match = routePattern.exec(line);
      if (match) {
        routes.push({
          verb: match[1].toUpperCase(),
          path: match[2],
          filePath,
          line: index + 1,
        });
        return;
      }

      const resMatch = resourcesPattern.exec(line);
      if (resMatch) {
        routes.push({
          verb: 'RESOURCES',
          path: resMatch[1],
          filePath,
          line: index + 1,
        });
      }
    });

    timer.stop({ file: path.relative(this.workspaceRoot || '', filePath), routes: routes.length });
    return routes;
  }

  updateFile(filePath: string, content: string) {
    const hash = crypto.createHash('sha1').update(content).digest('hex');
    const previousHash = this.fileHashes.get(filePath);
    if (previousHash === hash) {
      return;
    }

    const timer = new PerfTimer('router.updateFile');
    const routes = this.parseFile(filePath, content);
    this.routes = this.routes.filter(route => route.filePath !== filePath);
    this.routes.push(...routes);
    this.fileHashes.set(filePath, hash);
    timer.stop({ file: path.relative(this.workspaceRoot || '', filePath), routes: routes.length });
  }

  removeFile(filePath: string) {
    this.routes = this.routes.filter(route => route.filePath !== filePath);
    this.fileHashes.delete(filePath);
  }

  async scanWorkspace(workspaceRoot: string): Promise<void> {
    this.workspaceRoot = workspaceRoot;

    const scanDirectory = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const dirName = entry.name;
            if (['node_modules', 'deps', '_build', '.git', 'assets'].includes(dirName)) {
              continue;
            }
            scanDirectory(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('router.ex')) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              this.updateFile(fullPath, content);
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore errors
      }
    };

    time('router.scanWorkspace', () => scanDirectory(workspaceRoot), { root: workspaceRoot });
  }
}
