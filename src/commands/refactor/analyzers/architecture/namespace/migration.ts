/**
 * @module commands/refactor/analyzers/architecture/namespace/migration
 * @description Namespace migration plan generation
 */

import type { DirectoryInfo, NamespaceCategory } from '../../../core/types';
import type {
  NamespaceImportUpdate,
  NamespaceMigrationMove,
  NamespaceMigrationPlan,
} from './types';

/**
 * Generate migration plan for namespace organization
 */
export function generateNamespaceMigrationPlan(
  directories: DirectoryInfo[],
): NamespaceMigrationPlan {
  const moves: NamespaceMigrationMove[] = [];
  const importUpdates: NamespaceImportUpdate[] = [];

  const byCategory = new Map<NamespaceCategory, DirectoryInfo[]>();

  for (const dir of directories) {
    if (dir.isNamespaced) continue;
    if (dir.category === 'unknown') continue;

    if (!byCategory.has(dir.category)) {
      byCategory.set(dir.category, []);
    }
    byCategory.get(dir.category)?.push(dir);
  }

  for (const [category, dirs] of byCategory) {
    for (const dir of dirs) {
      const targetPath = `@${category}/@${dir.name}`;

      moves.push({
        from: dir.path,
        to: targetPath,
        reason: `Matches ${category} keywords`,
      });

      importUpdates.push({
        oldPath: `@/lib/${dir.name}`,
        newPath: `@/lib/@${category}/@${dir.name}`,
      });
    }
  }

  const namespacedBefore = directories.filter((d) => d.isNamespaced).length;
  const namespacedAfter = namespacedBefore + moves.length;
  const total = directories.length;

  return {
    moves,
    importUpdates,
    score: {
      before: total > 0 ? Math.round((namespacedBefore / total) * 100) : 100,
      after: total > 0 ? Math.round((namespacedAfter / total) * 100) : 100,
    },
  };
}
