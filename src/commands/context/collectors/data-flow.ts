/**
 * @module commands/context/collectors/data-flow
 * @description Trace data flow through the system for a domain
 *
 * Generates simplified data flow diagrams showing how data moves
 * through the application layers:
 * - Frontend: Component -> Hook -> tRPC
 * - Backend: Router -> Service -> Prisma
 * - Database: Schema -> Models
 */

import type { EntryPoint } from './entrypoints';

export interface DataFlowStep {
  step: number;
  description: string;
  file?: string;
}

export interface DataFlow {
  name: string;
  domain: string;
  steps: DataFlowStep[];
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate simplified data flow for common operations
 *
 * For a domain like "booking", generates flows like:
 * - Create booking: Form -> Hook -> tRPC -> Router -> Prisma
 * - List bookings: Component -> Hook -> tRPC -> Router -> Prisma
 * - Update booking: Form -> Hook -> tRPC -> Router -> Prisma
 */
export function generateDataFlows(domain: string, entryPoints: EntryPoint[]): DataFlow[] {
  const flows: DataFlow[] = [];

  // Find key entry points by role
  const router = entryPoints.find((e) => e.role === 'router' && e.layer === 'backend');
  const service = entryPoints.find((e) => e.role === 'service' && e.layer === 'backend');
  const hooks = entryPoints.find((e) => e.role === 'hooks' && e.layer === 'frontend');
  const components = entryPoints.find((e) => e.role === 'components' && e.layer === 'frontend');
  const schema = entryPoints.find((e) => e.role === 'schema' && e.layer === 'database');

  const domainCapitalized = capitalize(domain);

  // Only generate flows if we have at least a router
  if (!router) {
    return flows;
  }

  // Create flow (most common operation)
  flows.push({
    name: `Create ${domainCapitalized}`,
    domain,
    steps: buildCreateFlow(domainCapitalized, router, service, hooks, components, schema),
  });

  // List/Query flow
  flows.push({
    name: `List ${domainCapitalized}s`,
    domain,
    steps: buildListFlow(domainCapitalized, router, service, hooks, components, schema),
  });

  // Update flow (if we have components suggesting a form)
  if (components || hooks) {
    flows.push({
      name: `Update ${domainCapitalized}`,
      domain,
      steps: buildUpdateFlow(domainCapitalized, router, service, hooks, components, schema),
    });
  }

  return flows;
}

/**
 * Build create operation flow
 */
function buildCreateFlow(
  domain: string,
  router: EntryPoint,
  service?: EntryPoint,
  hooks?: EntryPoint,
  components?: EntryPoint,
  schema?: EntryPoint,
): DataFlowStep[] {
  const steps: DataFlowStep[] = [];
  let stepNum = 1;

  // Frontend: Component -> Hook
  if (components) {
    steps.push({
      step: stepNum++,
      description: `${domain}Form component`,
      file: components.file,
    });
  }

  if (hooks) {
    steps.push({
      step: stepNum++,
      description: `use${domain} hook -> tRPC mutation`,
      file: hooks.file,
    });
  } else if (components) {
    steps.push({
      step: stepNum++,
      description: 'tRPC mutation call',
    });
  }

  // Backend: Router -> Service -> Prisma
  if (service) {
    steps.push({
      step: stepNum++,
      description: `${domain.toLowerCase()}Router.create`,
      file: router.file,
    });
    steps.push({
      step: stepNum++,
      description: `${domain}Service.create`,
      file: service.file,
    });
  } else {
    steps.push({
      step: stepNum++,
      description: `${domain.toLowerCase()}Router.create -> Prisma`,
      file: router.file,
    });
  }

  // Database
  if (schema) {
    steps.push({
      step: stepNum++,
      description: `prisma.${domain.toLowerCase()}.create()`,
      file: schema.file,
    });
  } else {
    steps.push({
      step: stepNum,
      description: `prisma.${domain.toLowerCase()}.create()`,
    });
  }

  return steps;
}

/**
 * Build list/query operation flow
 */
function buildListFlow(
  domain: string,
  router: EntryPoint,
  service?: EntryPoint,
  hooks?: EntryPoint,
  components?: EntryPoint,
  schema?: EntryPoint,
): DataFlowStep[] {
  const steps: DataFlowStep[] = [];
  let stepNum = 1;

  // Frontend
  if (components) {
    steps.push({
      step: stepNum++,
      description: `${domain}List component`,
      file: components.file,
    });
  }

  if (hooks) {
    steps.push({
      step: stepNum++,
      description: `use${domain}s hook -> tRPC query`,
      file: hooks.file,
    });
  } else if (components) {
    steps.push({
      step: stepNum++,
      description: 'tRPC query call',
    });
  }

  // Backend
  if (service) {
    steps.push({
      step: stepNum++,
      description: `${domain.toLowerCase()}Router.list`,
      file: router.file,
    });
    steps.push({
      step: stepNum++,
      description: `${domain}Service.findMany`,
      file: service.file,
    });
  } else {
    steps.push({
      step: stepNum++,
      description: `${domain.toLowerCase()}Router.list -> Prisma`,
      file: router.file,
    });
  }

  // Database
  if (schema) {
    steps.push({
      step: stepNum++,
      description: `prisma.${domain.toLowerCase()}.findMany()`,
      file: schema.file,
    });
  } else {
    steps.push({
      step: stepNum,
      description: `prisma.${domain.toLowerCase()}.findMany()`,
    });
  }

  return steps;
}

/**
 * Build update operation flow
 */
function buildUpdateFlow(
  domain: string,
  router: EntryPoint,
  service?: EntryPoint,
  hooks?: EntryPoint,
  components?: EntryPoint,
  schema?: EntryPoint,
): DataFlowStep[] {
  const steps: DataFlowStep[] = [];
  let stepNum = 1;

  // Frontend
  if (components) {
    steps.push({
      step: stepNum++,
      description: `${domain}EditForm component`,
      file: components.file,
    });
  }

  if (hooks) {
    steps.push({
      step: stepNum++,
      description: `use${domain}Update hook -> tRPC mutation`,
      file: hooks.file,
    });
  } else if (components) {
    steps.push({
      step: stepNum++,
      description: 'tRPC mutation call',
    });
  }

  // Backend
  if (service) {
    steps.push({
      step: stepNum++,
      description: `${domain.toLowerCase()}Router.update`,
      file: router.file,
    });
    steps.push({
      step: stepNum++,
      description: `${domain}Service.update`,
      file: service.file,
    });
  } else {
    steps.push({
      step: stepNum++,
      description: `${domain.toLowerCase()}Router.update -> Prisma`,
      file: router.file,
    });
  }

  // Database
  if (schema) {
    steps.push({
      step: stepNum++,
      description: `prisma.${domain.toLowerCase()}.update()`,
      file: schema.file,
    });
  } else {
    steps.push({
      step: stepNum,
      description: `prisma.${domain.toLowerCase()}.update()`,
    });
  }

  return steps;
}
