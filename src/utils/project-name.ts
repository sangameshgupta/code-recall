import { execSync } from 'child_process';
import { basename } from 'path';

/**
 * Detect project name from git repository or directory name.
 * Used to tag observations per-project.
 */
export function getProjectName(cwd?: string): string {
  const dir = cwd ?? process.cwd();

  // Try git remote origin URL
  try {
    const remote = execSync('git remote get-url origin', { cwd: dir, encoding: 'utf-8', timeout: 5000 })
      .trim();

    if (remote) {
      // Extract repo name from URL
      // https://github.com/user/repo.git → repo
      // git@github.com:user/repo.git → repo
      const match = remote.match(/\/([^/]+?)(?:\.git)?$/);
      if (match) return match[1];
    }
  } catch {
    // Not a git repo or git not available
  }

  // Try git root directory name
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', { cwd: dir, encoding: 'utf-8', timeout: 5000 })
      .trim();
    if (gitRoot) return basename(gitRoot);
  } catch {
    // Not a git repo
  }

  // Fallback to directory name
  return basename(dir);
}
