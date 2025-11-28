#!/usr/bin/env tsx

/**
 * VFD Environment Readiness Check
 * T1.1.1 — Setup and Environment Check
 */

import { execSync, exec as execCallback } from 'node:child_process';
import type { ExecException } from 'node:child_process';
import {
  accessSync,
  constants as fsConstants,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execCallback);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
} as const;

type Status = 'PASS' | 'WARN' | 'FAIL';

interface VersionTriple {
  major: number;
  minor: number;
  patch: number;
}

interface CheckResult {
  required: string;
  actual: string;
  status: Status;
  message?: string;
}

interface TaskRunnerResult {
  command: string;
  status: Status;
  message?: string;
}

interface ConfigWorkspaceResult {
  path: string;
  status: Status;
  message?: string;
}

interface EnvCheckReport {
  timestamp: string;
  branch: string;
  checks: {
    nodejs: CheckResult;
    pnpm: CheckResult;
    taskRunner: TaskRunnerResult;
    configWorkspace: ConfigWorkspaceResult;
  };
  status: 'READY' | 'WARNING' | 'FAILED';
}

const log = (message: string, color?: keyof typeof COLORS) => {
  const colorCode = color ? COLORS[color] : '';
  process.stdout.write(`${colorCode}${message}${COLORS.reset}\n`);
};

const parseArgs = (): Record<string, string> => {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;

    const [flag, inlineValue] = arg.slice(2).split('=');
    if (inlineValue !== undefined) {
      parsed[flag] = inlineValue;
      continue;
    }

    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      parsed[flag] = next;
      i += 1;
    } else {
      parsed[flag] = 'true';
    }
  }

  return parsed;
};

const getGitBranch = (): string => {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
};

const parseVersion = (value: string): VersionTriple | null => {
  const sanitized = value.trim().replace(/^v/i, '').split(/\s+/)[0];
  if (!sanitized) return null;

  const [majorRaw, minorRaw = '0', patchRaw = '0'] = sanitized.split('.');
  const major = Number.parseInt(majorRaw, 10);
  const minor = Number.parseInt(minorRaw, 10);
  const patch = Number.parseInt(patchRaw, 10);

  if (Number.isNaN(major)) return null;

  return {
    major,
    minor: Number.isNaN(minor) ? 0 : minor,
    patch: Number.isNaN(patch) ? 0 : patch,
  };
};

const compareVersions = (a: VersionTriple, b: VersionTriple): number => {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
};

const formatActualVersion = (version: VersionTriple): string => `v${version.major}.${version.minor}.${version.patch}`;

const formatRequiredDisplay = (version: VersionTriple): string => `${version.major}.${version.minor}+`;

const ensureFileExists = (targetPath: string, label: string): string | null => {
  if (!existsSync(targetPath)) {
    return `${label} not found at ${targetPath}`;
  }
  return null;
};

const checkNodeVersion = (nvmrcPath: string): CheckResult => {
  const missingMessage = ensureFileExists(nvmrcPath, '.nvmrc');
  if (missingMessage) {
    return {
      required: '22.0+',
      actual: process.version,
      status: 'FAIL',
      message: missingMessage,
    };
  }

  const raw = readFileSync(nvmrcPath, 'utf-8').trim();
  if (!raw) {
    return {
      required: 'unknown',
      actual: process.version,
      status: 'FAIL',
      message: '.nvmrc is empty',
    };
  }

  const requiredVersion = parseVersion(raw);
  const actualVersion = parseVersion(process.version);

  if (!requiredVersion || !actualVersion) {
    return {
      required: raw,
      actual: process.version,
      status: 'FAIL',
      message: 'Unable to parse Node.js version from .nvmrc or process.version',
    };
  }

  const comparison = compareVersions(actualVersion, requiredVersion);
  const requiredLabel = formatRequiredDisplay(requiredVersion);
  const actualLabel = formatActualVersion(actualVersion);

  if (comparison >= 0) {
    return {
      required: requiredLabel,
      actual: actualLabel,
      status: 'PASS',
    };
  }

  return {
    required: requiredLabel,
    actual: actualLabel,
    status: 'FAIL',
    message: `Node.js ${requiredLabel} is required. Current version: ${actualLabel}`,
  };
};

const checkPnpmVersion = (packageJsonPath: string): CheckResult => {
  const packageJsonMissing = ensureFileExists(packageJsonPath, 'package.json');
  if (packageJsonMissing) {
    return {
      required: 'pnpm@10.7.0',
      actual: 'unknown',
      status: 'FAIL',
      message: packageJsonMissing,
    };
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { packageManager?: string };
  const packageManager = packageJson.packageManager;

  if (!packageManager || !packageManager.startsWith('pnpm@')) {
    return {
      required: 'pnpm@10.7.0',
      actual: 'unknown',
      status: 'FAIL',
      message: 'packageManager field is missing or not set to pnpm',
    };
  }

  const requiredRaw = packageManager.split('@')[1] ?? '';
  const requiredVersion = parseVersion(requiredRaw);
  if (!requiredVersion) {
    return {
      required: requiredRaw || 'pnpm@?',
      actual: 'unknown',
      status: 'FAIL',
      message: `Unable to parse required pnpm version from "${packageManager}"`,
    };
  }

  let actualRaw = 'unknown';
  try {
    actualRaw = execSync('pnpm --version', { encoding: 'utf-8' }).trim();
  } catch {
    return {
      required: requiredRaw,
      actual: 'not installed',
      status: 'FAIL',
      message: 'pnpm is not installed or not available in PATH',
    };
  }

  const actualVersion = parseVersion(actualRaw);
  if (!actualVersion) {
    return {
      required: requiredRaw,
      actual: actualRaw,
      status: 'FAIL',
      message: `Unable to parse current pnpm version from "${actualRaw}"`,
    };
  }

  const requiredLabel = `${requiredVersion.major}.${requiredVersion.minor}.${requiredVersion.patch}`;
  const actualLabel = `${actualVersion.major}.${actualVersion.minor}.${actualVersion.patch}`;

  if (actualVersion.major !== requiredVersion.major) {
    return {
      required: requiredLabel,
      actual: actualLabel,
      status: 'FAIL',
      message: `pnpm major version mismatch. Required: ${requiredLabel}, Actual: ${actualLabel}`,
    };
  }

  if (actualVersion.minor !== requiredVersion.minor) {
    return {
      required: requiredLabel,
      actual: actualLabel,
      status: 'WARN',
      message: `pnpm minor version mismatch. Required: ${requiredLabel}, Actual: ${actualLabel}`,
    };
  }

  return {
    required: requiredLabel,
    actual: actualLabel,
    status: 'PASS',
  };
};

const checkTaskRunner = async (command: string, cwd: string): Promise<TaskRunnerResult> => {
  try {
    await exec(command, {
      cwd,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      command,
      status: 'PASS',
    };
  } catch (error) {
    const execError = error as ExecException & { stderr?: string };
    const stderr = execError.stderr ? execError.stderr.toString().trim() : '';
    const exitCode = typeof execError.code === 'number' ? execError.code : undefined;

    return {
      command,
      status: 'FAIL',
      message: `Task runner command failed${exitCode !== undefined ? ` (exit code ${exitCode})` : ''}.${
        stderr ? ` stderr: ${stderr.split('\n').slice(-5).join('\n')}` : ''
      }`,
    };
  }
};

const checkConfigWorkspace = (physicalPath: string, displayPath: string): ConfigWorkspaceResult => {
  if (!existsSync(physicalPath)) {
    return {
      path: displayPath,
      status: 'FAIL',
      message: `Config workspace directory does not exist: ${displayPath}`,
    };
  }

  try {
    accessSync(physicalPath, fsConstants.R_OK);
  } catch {
    return {
      path: displayPath,
      status: 'FAIL',
      message: `Config workspace is not readable: ${displayPath}`,
    };
  }

  const skillsPhysicalPath = path.join(physicalPath, 'skills');
  if (!existsSync(skillsPhysicalPath)) {
    const relativeSkills = path.join(displayPath, 'skills');

    return {
      path: displayPath,
      status: 'FAIL',
      message: `Skills directory not found: ${relativeSkills}`,
    };
  }

  try {
    accessSync(skillsPhysicalPath, fsConstants.R_OK);
  } catch {
    const relativeSkills = path.join(displayPath, 'skills');
    return {
      path: displayPath,
      status: 'FAIL',
      message: `Skills directory is not readable: ${relativeSkills}`,
    };
  }

  const entries = readdirSync(skillsPhysicalPath);
  const mdFiles = entries.filter((entry) => entry.toLowerCase().endsWith('.md'));

  if (mdFiles.length === 0) {
    return {
      path: displayPath,
      status: 'WARN',
      message: `No .md files found in ${path.join(displayPath, 'skills')}`,
    };
  }

  return {
    path: displayPath,
    status: 'PASS',
    message: `Found ${mdFiles.length} skill file(s)`,
  };
};

const printCheckResult = (
  label: string,
  result: CheckResult | TaskRunnerResult | ConfigWorkspaceResult,
) => {
  const status = result.status;
  const symbol = status === 'PASS' ? '✓' : status === 'WARN' ? '⚠' : '✗';
  const color: keyof typeof COLORS = status === 'PASS' ? 'green' : status === 'WARN' ? 'yellow' : 'red';

  log(`  ${symbol} ${label}: ${status}`, color);

  if ('required' in result && 'actual' in result) {
    log(`    Required: ${result.required}`, 'cyan');
    log(`    Actual: ${result.actual}`, 'cyan');
  } else if ('command' in result) {
    log(`    Command: ${result.command}`, 'cyan');
  } else if ('path' in result) {
    log(`    Path: ${result.path}`, 'cyan');
  }

  if (result.message) {
    log(`    ${result.message}`, color);
  }

  log('', undefined);
};

const printActionableInstructions = (report: EnvCheckReport) => {
  const { nodejs, pnpm, taskRunner, configWorkspace } = report.checks;

  if (nodejs.status === 'FAIL') {
    log('\n📋 How to fix Node.js version:', 'yellow');
    log(`  1. Install nvm: https://github.com/nvm-sh/nvm`, 'cyan');
    log(`  2. Run: nvm install ${nodejs.required}`, 'cyan');
    log(`  3. Run: nvm use ${nodejs.required}`, 'cyan');
  }

  if (pnpm.status === 'FAIL') {
    log('\n📋 How to fix pnpm:', 'yellow');
    log(`  1. Install pnpm: npm install -g pnpm@${pnpm.required}`, 'cyan');
    log(`  2. Or use corepack: corepack enable && corepack prepare pnpm@${pnpm.required} --activate`, 'cyan');
  } else if (pnpm.status === 'WARN') {
    log('\n⚠️  pnpm version mismatch (non-critical):', 'yellow');
    log(`  Consider updating to pnpm@${pnpm.required} for consistency`, 'cyan');
  }

  if (taskRunner.status === 'FAIL') {
    log('\n📋 How to fix Task Runner:', 'yellow');
    log(`  1. Ensure you are in the typescript/ directory`, 'cyan');
    log(`  2. Run: pnpm install`, 'cyan');
    log(`  3. Verify manually: ${taskRunner.command}`, 'cyan');
  }

  if (configWorkspace.status === 'FAIL') {
    log('\n📋 Configure VFD workspace:', 'yellow');
    log(`  1. Create the workspace: mkdir -p ${configWorkspace.path}/skills`, 'cyan');
    log(`  2. Add at least one skill definition (*.md)`, 'cyan');
  } else if (configWorkspace.status === 'WARN') {
    log('\n⚠️  Skills directory is empty:', 'yellow');
    log(`  Add at least one .md file under ${configWorkspace.path}/skills to define a VFD skill.`, 'cyan');
  }
};

const collectStatusFlags = (report: EnvCheckReport) => {
  const statuses: Status[] = [
    report.checks.nodejs.status,
    report.checks.pnpm.status,
    report.checks.taskRunner.status as Status,
    report.checks.configWorkspace.status,
  ];

  const hasFailures = statuses.some((status) => status === 'FAIL');
  const hasWarnings = statuses.some((status) => status === 'WARN');

  return { hasFailures, hasWarnings };
};

const main = async () => {
  const args = parseArgs();
  const branch = getGitBranch();
  const typescriptRoot = path.resolve(__dirname, '../..');
  const projectRoot = path.resolve(__dirname, '../../..');

  log('\n╔════════════════════════════════════════════════╗', 'blue');
  log('║   VFD Environment Readiness Check (T1.1.1)   ║', 'blue');
  log('╚════════════════════════════════════════════════╝\n', 'blue');

  const now = new Date().toISOString();
  log(`Branch: ${branch}`, 'cyan');
  log(`Timestamp: ${now}\n`, 'cyan');

  const taskRunnerCommand =
    args['task-runner'] || process.env.VFD_TASK_RUNNER_CMD || 'pnpm --filter @emberai/agent-node cli:dev -- doctor --help';

  const workspaceArg = args['workspace'];
  const workspaceDisplayPath = workspaceArg ? workspaceArg : 'config/vfd';
  const workspacePhysicalPath = path.resolve(projectRoot, workspaceDisplayPath);

  log('Running checks...\n', 'blue');

  const nodejsCheck = checkNodeVersion(path.join(typescriptRoot, '.nvmrc'));
  printCheckResult('Node.js Version', nodejsCheck);

  const pnpmCheck = checkPnpmVersion(path.join(typescriptRoot, 'package.json'));
  printCheckResult('pnpm Version', pnpmCheck);

  const taskRunnerCheck = await checkTaskRunner(taskRunnerCommand, typescriptRoot);
  printCheckResult('Task Runner (Agent Doctor)', taskRunnerCheck);

  const configWorkspaceCheck = checkConfigWorkspace(workspacePhysicalPath, workspaceDisplayPath);
  printCheckResult('Config Workspace', configWorkspaceCheck);

  const report: EnvCheckReport = {
    timestamp: now,
    branch,
    checks: {
      nodejs: nodejsCheck,
      pnpm: pnpmCheck,
      taskRunner: taskRunnerCheck,
      configWorkspace: configWorkspaceCheck,
    },
    status: 'READY',
  };

  const { hasFailures, hasWarnings } = collectStatusFlags(report);
  report.status = hasFailures ? 'FAILED' : hasWarnings ? 'WARNING' : 'READY';

  const vibecodeDir = path.join(projectRoot, '.vibecode', branch);
  mkdirSync(vibecodeDir, { recursive: true });
  const reportPath = path.join(vibecodeDir, 'env-check.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  log('─'.repeat(50), 'blue');
  log(`\nOverall Status: ${report.status}`,
    report.status === 'READY' ? 'green' : report.status === 'WARNING' ? 'yellow' : 'red');
  log(`Report saved to: ${reportPath}\n`, 'cyan');

  if (hasFailures || hasWarnings) {
    printActionableInstructions(report);
  }

  if (report.status === 'READY') {
    log('\n✅ All critical checks passed! Environment is ready for VFD implementation.\n', 'green');
    process.exit(0);
  }

  if (report.status === 'WARNING') {
    log('\n⚠️  Environment has warnings but can proceed with caution.\n', 'yellow');
    process.exit(0);
  }

  log('\n❌ Environment check failed. Please fix the issues above before proceeding.\n', 'red');
  process.exit(1);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  log(`\n❌ Unexpected error: ${message}`, 'red');
  if (error) {
    console.error(error);
  }
  process.exit(1);
});
