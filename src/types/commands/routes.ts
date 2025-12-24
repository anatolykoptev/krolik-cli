/**
 * @module types/commands/routes
 * @description Routes analysis result types
 */

/**
 * Route procedure definition
 */
export interface RouteProcedure {
  name: string;
  type: 'query' | 'mutation' | 'subscription';
  input?: string;
  output?: string;
}

/**
 * Router definition
 */
export interface RouterDefinition {
  name: string;
  file: string;
  procedures: RouteProcedure[];
}

/**
 * Routes analysis result
 */
export interface RoutesResult {
  routers: RouterDefinition[];
  totalProcedures: number;
  queries: number;
  mutations: number;
}
