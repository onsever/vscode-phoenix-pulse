import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PerfTimer, time } from './utils/perf';

type BlockEntry =
  | { type: 'scope'; alias?: string; pendingDo: boolean; path?: string; pipeline?: string }
  | { type: 'pipeline'; name: string; pendingDo: boolean }
  | { type: 'resource'; path: string; helperBase: string; param: string; pendingDo: boolean }
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

/**
 * Expand a resources declaration into the RESTful routes that Phoenix generates
 * Supports regular resources, singleton resources, and custom param names
 */
function expandResourceRoutes(
  basePath: string,
  helperBase: string,
  only?: string[],
  except?: string[],
  singleton?: boolean,
  paramName?: string
): Array<{ verb: string; path: string; action: string; params: string[] }> {
  // Use custom param name if provided, otherwise default to 'id'
  const param = paramName || 'id';

  // Singleton resources don't have :id parameters (except for delete in some cases)
  // They represent a single resource (e.g., current user's account, profile, settings)
  const allActions = singleton
    ? [
        // Singleton resource routes (no param)
        { action: 'show', verb: 'GET', path: '', params: [] },
        { action: 'new', verb: 'GET', path: '/new', params: [] },
        { action: 'create', verb: 'POST', path: '', params: [] },
        { action: 'edit', verb: 'GET', path: '/edit', params: [] },
        { action: 'update', verb: 'PATCH', path: '', params: [] },
        { action: 'update', verb: 'PUT', path: '', params: [] },
        { action: 'delete', verb: 'DELETE', path: '', params: [] },
      ]
    : [
        // Regular collection resource routes (with param - default :id or custom like :slug)
        { action: 'index', verb: 'GET', path: '', params: [] },
        { action: 'new', verb: 'GET', path: '/new', params: [] },
        { action: 'create', verb: 'POST', path: '', params: [] },
        { action: 'show', verb: 'GET', path: `/:${param}`, params: [param] },
        { action: 'edit', verb: 'GET', path: `/:${param}/edit`, params: [param] },
        { action: 'update', verb: 'PATCH', path: `/:${param}`, params: [param] },
        { action: 'update', verb: 'PUT', path: `/:${param}`, params: [param] },
        { action: 'delete', verb: 'DELETE', path: `/:${param}`, params: [param] },
      ];

  // Filter actions based on only/except options
  let filteredActions = allActions;

  if (only && only.length > 0) {
    // Only include specified actions
    filteredActions = allActions.filter(route => only.includes(route.action));
  } else if (except && except.length > 0) {
    // Exclude specified actions
    filteredActions = allActions.filter(route => !except.includes(route.action));
  }

  // Generate full routes
  return filteredActions.map(route => ({
    verb: route.verb,
    path: basePath + route.path,
    action: route.action,
    params: route.params,
  }));
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
    const matchPattern = /^\s*match\s+([:\[\]\w\s,*]+?)\s*,\s*"([^"]+)"(?:\s*,\s*([A-Za-z0-9_.!?]+))?(?:\s*,\s*:(\w+))?/;
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

    // Helper to check if we're inside a nested resource block
    const getParentResources = (): Array<{ path: string; helperBase: string; param: string }> => {
      const parents: Array<{ path: string; helperBase: string; param: string }> = [];
      for (const entry of blockStack) {
        if (entry.type === 'resource') {
          parents.push({
            path: entry.path,
            helperBase: entry.helperBase,
            param: entry.param,
          });
        }
      }
      return parents;
    };

    // Helper to consume pending resource do blocks
    const consumePendingResourceDo = (): boolean => {
      for (let i = blockStack.length - 1; i >= 0; i--) {
        const entry = blockStack[i];
        if (entry.type === 'resource' && entry.pendingDo) {
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
        // Update the nearest scope with pipeline info (immutable update)
        for (let i = blockStack.length - 1; i >= 0; i--) {
          const entry = blockStack[i];
          if (entry.type === 'scope') {
            // Replace entry with new object instead of mutating
            blockStack[i] = { ...entry, pipeline: pipelineName };
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
        const consumed = consumePendingScopeDo() || consumePendingResourceDo();
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
        // Parse match routes (match :*, match [:get, :post], etc.)
        const matchRouteMatch = matchPattern.exec(line);
        if (matchRouteMatch) {
          const verbsString = matchRouteMatch[1].trim();
          const routePath = matchRouteMatch[2];
          const controller = matchRouteMatch[3];
          const action = matchRouteMatch[4];
          const explicitAliasMatch = line.match(/\bas:\s*:(\w+)/);
          const explicitAlias = explicitAliasMatch ? explicitAliasMatch[1] : undefined;
          const { helperBase, params } = deriveHelperBase(routePath, aliasParts, explicitAlias);
          const fullPath = currentScopePath ? currentScopePath + routePath : routePath;

          // Parse verbs from the match pattern
          let verbs: string[] = [];
          if (verbsString === ':*') {
            // Wildcard - matches all verbs
            verbs = ['*'];
          } else if (verbsString.startsWith('[')) {
            // List of verbs: [:get, :post, :put]
            const verbMatches = verbsString.match(/:(\w+)/g);
            if (verbMatches) {
              verbs = verbMatches.map(v => v.substring(1).toUpperCase());
            }
          } else if (verbsString.startsWith(':')) {
            // Single verb: :options
            verbs = [verbsString.substring(1).toUpperCase()];
          }

          // Create a route for each verb
          for (const verb of verbs) {
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
          }
        } else {
          const resMatch = resourcesPattern.exec(line);
          if (resMatch) {
            const routePath = resMatch[1];
            const explicitAliasMatch = line.match(/\bas:\s*:(\w+)/);
            const explicitAlias = explicitAliasMatch ? explicitAliasMatch[1] : undefined;
  
            // Parse resource options (only: [...], except: [...], singleton: true, param: "slug")
            const resourceOptions: { only?: string[]; except?: string[]; singleton?: boolean; param?: string } = {};
            const onlyMatch = line.match(/only:\s*\[([^\]]+)\]/);
            const exceptMatch = line.match(/except:\s*\[([^\]]+)\]/);
            const singletonMatch = line.match(/singleton:\s*(true|false)/);
            const paramMatch = line.match(/param:\s*"([^"]+)"/);
  
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
            if (singletonMatch) {
              resourceOptions.singleton = singletonMatch[1] === 'true';
            }
            if (paramMatch) {
              resourceOptions.param = paramMatch[1];
            }
  
            // Check if this is a nested resource (has parent resources)
            const parentResources = getParentResources();
  
            // Build full path including parent resource paths
            let fullPath = currentScopePath ? currentScopePath + routePath : routePath;
            if (parentResources.length > 0) {
              // Prepend parent resource paths and params
              const parentPath = parentResources.map(p => `${p.path}/:${p.param}`).join('');
              fullPath = (currentScopePath || '') + parentPath + routePath;
            }
  
            // Build helper base including parent helpers
            // For nested resources, don't include scope alias - it's already in the parent
            const { helperBase: baseHelper } = parentResources.length > 0
              ? deriveHelperBase(routePath, [], explicitAlias)  // No alias parts for nested
              : deriveHelperBase(routePath, aliasParts, explicitAlias);  // Include alias for top-level
  
            let helperBase = baseHelper;
            if (parentResources.length > 0) {
              // Combine parent helpers with current helper: user_post_path, user_post_comment_path
              const parentHelpers = parentResources.map(p => p.helperBase).join('_');
              helperBase = `${parentHelpers}_${baseHelper}`;
            }
  
            // Determine the param name for this resource
            const currentParam = resourceOptions.param || 'id';
  
            // For nested resources, derive the param name as {resource_name}_id
            // Extract the resource name from the path (e.g., "/users" -> "user")
            const resourceName = routePath.split('/').filter(Boolean).pop() || 'resource';
            const singularResourceName = singularize(normalizeSegment(resourceName));
            const nestedParam = currentParam === 'id' ? `${singularResourceName}_id` : currentParam;
  
            // Check if this resource has a do block (nested resources inside)
            const hasDoBlock = /\bdo\s*($|#)/.test(line);
  
            // If this resource has nested resources, add it to the block stack
            if (hasDoBlock) {
              blockStack.push({
                type: 'resource',
                path: routePath,
                helperBase: baseHelper,
                param: nestedParam,  // Use {resource}_id for nested params
                pendingDo: !/\bdo\b/.test(line),
              });
            }
  
            // Expand resources into individual routes
            const expandedRoutes = expandResourceRoutes(
              fullPath,
              helperBase,
              resourceOptions.only,
              resourceOptions.except,
              resourceOptions.singleton,
              resourceOptions.param
            );
  
            // Build params array including parent params
            const parentParams = parentResources.map(p => p.param);
  
            // Add each expanded route to the routes array
            for (const expandedRoute of expandedRoutes) {
              // Combine parent params with this route's params
              const allParams = [...parentParams, ...expandedRoute.params];
  
              routes.push({
                verb: expandedRoute.verb,
                path: expandedRoute.path,
                filePath,
                line: index + 1,
                controller: resMatch[2],
                action: expandedRoute.action,
                helperBase,
                params: allParams,
                aliasPrefix,
                routeAlias: explicitAlias,
                isResource: true,
                resourceOptions: Object.keys(resourceOptions).length > 0 ? resourceOptions : undefined,
                pipeline: currentPipeline,
                scopePath: currentScopePath,
              });
            }
          }
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

    // Parse FIRST (don't touch this.routes yet)
    const newRoutes = this.parseFile(filePath, content);

    // Atomic swap - single assignment instead of filter + push
    // Race window reduced from potential microseconds to truly atomic
    const otherRoutes = this.routes.filter(route => route.filePath !== filePath);
    this.routes = [...otherRoutes, ...newRoutes];

    this.fileHashes.set(filePath, hash);
    timer.stop({ file: path.relative(this.workspaceRoot || '', filePath), routes: newRoutes.length });
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
