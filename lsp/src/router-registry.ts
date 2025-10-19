import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PerfTimer, time } from './utils/perf';

type BlockEntry =
  | { type: 'scope'; alias?: string; pendingDo: boolean; path?: string; pipeline?: string }
  | { type: 'pipeline'; name: string; pendingDo: boolean }
  | { type: 'generic' };

function singularize(segment: string): string {
  if (!segment) {
    return segment;
  }
  if (segment.endsWith('ies') && segment.length > 3) {
    return segment.slice(0, -3) + 'y';
  }
  if (segment.endsWith('ses') && segment.length > 3) {
    return segment.slice(0, -2);
  }
  if ((segment.endsWith('xes') || segment.endsWith('zes')) && segment.length > 3) {
    return segment.slice(0, -2);
  }
  if (segment.endsWith('s') && !segment.endsWith('ss') && segment.length > 1) {
    return segment.slice(0, -1);
  }
  return segment;
}

function normalizeSegment(segment: string): string {
  return segment
    .replace(/[:*]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function extractPathParams(routePath: string): string[] {
  return routePath
    .split('/')
    .filter(part => part.startsWith(':') || part.startsWith('*'))
    .map(part => normalizeSegment(part));
}

function deriveHelperBase(routePath: string, aliasParts: string[], explicitAlias?: string): { helperBase: string; params: string[] } {
  const params = extractPathParams(routePath);
  let baseSegment: string;

  if (explicitAlias) {
    baseSegment = normalizeSegment(explicitAlias);
  } else {
    const segments = routePath
      .split('/')
      .filter(part => part.length > 0 && !part.startsWith(':') && !part.startsWith('*'))
      .map(seg => normalizeSegment(seg))
      .filter(Boolean)
      .map(seg => singularize(seg));

    if (segments.length === 0) {
      baseSegment = 'root';
    } else {
      baseSegment = segments.join('_');
    }
  }

  const prefix = aliasParts.filter(Boolean).map(part => normalizeSegment(part));
  const helperParts = [...prefix, baseSegment].filter(Boolean);
  const helperBase = helperParts.length > 0 ? helperParts.join('_') : baseSegment;

  return { helperBase, params };
}

export interface RouteInfo {
  path: string;
  verb: string;
  filePath: string;
  line: number;
  controller?: string;
  action?: string;
  helperBase: string;
  params: string[];
  aliasPrefix?: string;
  routeAlias?: string;
  isResource: boolean;
  // LiveView routes
  liveModule?: string;
  liveAction?: string;
  // Forward routes
  forwardTo?: string;
  // Resource options
  resourceOptions?: {
    only?: string[];
    except?: string[];
  };
  // Pipeline info
  pipeline?: string;
  // Scope path
  scopePath?: string;
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

  /**
   * Find route by exact path match
   */
  findRouteByPath(path: string): RouteInfo | undefined {
    return this.routes.find(route => route.path === path);
  }

  /**
   * Find all routes matching a helper base
   */
  findRoutesByHelper(helperBase: string): RouteInfo[] {
    return this.routes.filter(route => route.helperBase === helperBase);
  }

  /**
   * Get all live routes
   */
  getLiveRoutes(): RouteInfo[] {
    return this.routes.filter(route => route.verb === 'LIVE');
  }

  /**
   * Get all forward routes
   */
  getForwardRoutes(): RouteInfo[] {
    return this.routes.filter(route => route.verb === 'FORWARD');
  }

  /**
   * Get valid actions for a resource route
   */
  getValidResourceActions(helperBase: string): string[] {
    const route = this.routes.find(r => r.helperBase === helperBase && r.isResource);
    if (!route || !route.resourceOptions) {
      return ['index', 'new', 'create', 'show', 'edit', 'update', 'delete'];
    }

    const allActions = ['index', 'new', 'create', 'show', 'edit', 'update', 'delete'];

    if (route.resourceOptions.only) {
      return route.resourceOptions.only;
    }

    if (route.resourceOptions.except) {
      return allActions.filter(action => !route.resourceOptions?.except?.includes(action));
    }

    return allActions;
  }

  private parseFile(filePath: string, content: string): RouteInfo[] {
    const timer = new PerfTimer('router.parseFile');
    const lines = content.split('\n');
    const routes: RouteInfo[] = [];

    // Enhanced patterns for different route types
    const routePattern = /^\s*(get|post|put|patch|delete|options|head)\s+"([^"]+)"(?:\s*,\s*([A-Za-z0-9_.!?]+))?(?:\s*,\s*:(\w+))?/;
    const livePattern = /^\s*live\s+"([^"]+)"\s*,\s*([A-Za-z0-9_.]+)(?:\s*,\s*:(\w+))?/;
    const forwardPattern = /^\s*forward\s+"([^"]+)"\s*,\s*([A-Za-z0-9_.]+)/;
    const resourcesPattern = /^\s*resources\s+"([^"]+)"(?:\s*,\s*([A-Za-z0-9_.!?]+))?/;
    const pipelinePattern = /^\s*pipe_through\s+:(\w+)/;
    const scopePattern = /^\s*scope\s+"([^"]+)"/;

    const blockStack: BlockEntry[] = [];

    // Helper to get current pipeline from stack
    const getCurrentPipeline = (): string | undefined => {
      for (let i = blockStack.length - 1; i >= 0; i--) {
        const entry = blockStack[i];
        if (entry.type === 'pipeline') {
          return entry.name;
        }
        if (entry.type === 'scope' && entry.pipeline) {
          return entry.pipeline;
        }
      }
      return undefined;
    };

    // Helper to get full scope path from stack
    const getCurrentScopePath = (): string | undefined => {
      const paths: string[] = [];
      for (const entry of blockStack) {
        if (entry.type === 'scope' && entry.path && entry.path !== '/') {
          paths.push(entry.path);
        }
      }
      return paths.length > 0 ? paths.join('') : undefined;
    };

    const updateNearestScopeAlias = (alias?: string) => {
      if (!alias) {
        return;
      }
      for (let i = blockStack.length - 1; i >= 0; i--) {
        const entry = blockStack[i];
        if (entry.type === 'scope') {
          if (!entry.alias) {
            entry.alias = alias;
          }
          break;
        }
      }
    };

    const consumePendingScopeDo = (): boolean => {
      for (let i = blockStack.length - 1; i >= 0; i--) {
        const entry = blockStack[i];
        if (entry.type === 'scope' && entry.pendingDo) {
          entry.pendingDo = false;
          return true;
        }
      }
      return false;
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        return;
      }

      // Check for pipe_through
      const pipelineMatch = pipelinePattern.exec(line);
      if (pipelineMatch) {
        const pipelineName = pipelineMatch[1];
        // Update the nearest scope with pipeline info
        for (let i = blockStack.length - 1; i >= 0; i--) {
          const entry = blockStack[i];
          if (entry.type === 'scope') {
            entry.pipeline = pipelineName;
            break;
          }
        }
      }

      const scopeStart = /^\s*scope\b/.test(line);
      const aliasMatch = line.match(/\bas:\s*:(\w+)/);
      const scopePathMatch = scopePattern.exec(line);

      if (scopeStart) {
        blockStack.push({
          type: 'scope',
          alias: aliasMatch ? aliasMatch[1] : undefined,
          path: scopePathMatch ? scopePathMatch[1] : undefined,
          pendingDo: !/\bdo\b/.test(line),
        });
      } else if (aliasMatch) {
        updateNearestScopeAlias(aliasMatch[1]);
      }

      let doCount = (line.match(/\bdo\b/g) || []).length;

      if (scopeStart && doCount > 0) {
        const currentScope = blockStack[blockStack.length - 1];
        if (currentScope && currentScope.type === 'scope') {
          currentScope.pendingDo = false;
          doCount -= 1;
        }
      }

      while (doCount > 0) {
        const consumed = consumePendingScopeDo();
        if (!consumed) {
          blockStack.push({ type: 'generic' });
        }
        doCount -= 1;
      }

      const aliasParts = blockStack
        .filter(entry => entry.type === 'scope')
        .map(entry => entry.alias)
        .filter((alias): alias is string => !!alias);
      const aliasPrefix = aliasParts.length > 0 ? aliasParts.map(normalizeSegment).join('_') : undefined;

      // Get current context from block stack
      const currentPipeline = getCurrentPipeline();
      const currentScopePath = getCurrentScopePath();

      // Parse live routes
      const liveMatch = livePattern.exec(line);
      if (liveMatch) {
        const routePath = liveMatch[1];
        const liveModule = liveMatch[2];
        const liveActionMatch = liveModule.match(/\.([A-Z]\w+)$/);
        const liveAction = liveActionMatch ? liveActionMatch[1] : undefined;
        const explicitAliasMatch = line.match(/\bas:\s*:(\w+)/);
        const explicitAlias = explicitAliasMatch ? explicitAliasMatch[1] : undefined;
        const { helperBase, params } = deriveHelperBase(routePath, aliasParts, explicitAlias);
        const fullPath = currentScopePath ? currentScopePath + routePath : routePath;

        routes.push({
          verb: 'LIVE',
          path: fullPath,
          filePath,
          line: index + 1,
          liveModule,
          liveAction,
          helperBase,
          params,
          aliasPrefix,
          routeAlias: explicitAlias,
          isResource: false,
          pipeline: currentPipeline,
          scopePath: currentScopePath,
        });
        return; // Skip to next line
      }

      // Parse forward routes
      const forwardMatch = forwardPattern.exec(line);
      if (forwardMatch) {
        const routePath = forwardMatch[1];
        const forwardTo = forwardMatch[2];
        const explicitAliasMatch = line.match(/\bas:\s*:(\w+)/);
        const explicitAlias = explicitAliasMatch ? explicitAliasMatch[1] : undefined;
        const { helperBase, params } = deriveHelperBase(routePath, aliasParts, explicitAlias);
        const fullPath = currentScopePath ? currentScopePath + routePath : routePath;

        routes.push({
          verb: 'FORWARD',
          path: fullPath,
          filePath,
          line: index + 1,
          forwardTo,
          helperBase,
          params,
          aliasPrefix,
          routeAlias: explicitAlias,
          isResource: false,
          pipeline: currentPipeline,
          scopePath: currentScopePath,
        });
        return; // Skip to next line
      }

      // Parse regular routes (get, post, etc.)
      const routeMatch = routePattern.exec(line);
      if (routeMatch) {
        const verb = routeMatch[1].toUpperCase();
        const routePath = routeMatch[2];
        const controller = routeMatch[3];
        const action = routeMatch[4];
        const explicitAliasMatch = line.match(/\bas:\s*:(\w+)/);
        const explicitAlias = explicitAliasMatch ? explicitAliasMatch[1] : undefined;
        const { helperBase, params } = deriveHelperBase(routePath, aliasParts, explicitAlias);
        const fullPath = currentScopePath ? currentScopePath + routePath : routePath;

        routes.push({
          verb,
          path: fullPath,
          filePath,
          line: index + 1,
          controller,
          action,
          helperBase,
          params,
          aliasPrefix,
          routeAlias: explicitAlias,
          isResource: false,
          pipeline: currentPipeline,
          scopePath: currentScopePath,
        });
      } else {
        const resMatch = resourcesPattern.exec(line);
        if (resMatch) {
          const routePath = resMatch[1];
          const explicitAliasMatch = line.match(/\bas:\s*:(\w+)/);
          const explicitAlias = explicitAliasMatch ? explicitAliasMatch[1] : undefined;
          const { helperBase, params } = deriveHelperBase(routePath, aliasParts, explicitAlias);
          const resourceParams = params.length > 0 ? params : ['id'];
          const fullPath = currentScopePath ? currentScopePath + routePath : routePath;

          // Parse resource options (only: [...], except: [...])
          const resourceOptions: { only?: string[]; except?: string[] } = {};
          const onlyMatch = line.match(/only:\s*\[([^\]]+)\]/);
          const exceptMatch = line.match(/except:\s*\[([^\]]+)\]/);

          if (onlyMatch) {
            resourceOptions.only = onlyMatch[1]
              .split(',')
              .map(a => a.trim().replace(/^:/, ''))
              .filter(Boolean);
          }
          if (exceptMatch) {
            resourceOptions.except = exceptMatch[1]
              .split(',')
              .map(a => a.trim().replace(/^:/, ''))
              .filter(Boolean);
          }

          routes.push({
            verb: 'RESOURCES',
            path: fullPath,
            filePath,
            line: index + 1,
            controller: resMatch[2],
            helperBase,
            params: resourceParams,
            aliasPrefix,
            routeAlias: explicitAlias,
            isResource: true,
            resourceOptions: Object.keys(resourceOptions).length > 0 ? resourceOptions : undefined,
            pipeline: currentPipeline,
            scopePath: currentScopePath,
          });
        }
      }

      const endMatches = line.match(/\bend\b/g);
      const endCount = endMatches ? endMatches.length : 0;
      for (let i = 0; i < endCount; i++) {
        const popped = blockStack.pop();
        if (!popped) {
          continue;
        }
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
