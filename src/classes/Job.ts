import * as vscode from 'vscode';
import { EXIT_JOB_COMMAND, RUN_JOB_COMMAND } from '../constants';

export default class Job extends vscode.TreeItem {
  private jobName: string;

  constructor(
    public readonly label: string,
    isRunning: boolean,
    hasChildJob: boolean
  ) {
    super(label);
    const tooltip = `Runs the CircleCI® job ${this.label}`;
    this.jobName = label;
    this.collapsibleState = hasChildJob
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;

    this.iconPath = new vscode.ThemeIcon('debug-start');
    this.tooltip = `Runs the CircleCI® job ${this.label}`;
    this.command = {
      title: label,
      command: RUN_JOB_COMMAND,
      tooltip,
      arguments: [this.jobName, this],
    };

    if (isRunning) {
      this.setIsRunning();
    }
  }

  getJobName(): string {
    return this.jobName;
  }

  setIsRunning(): void {
    this.contextValue = 'isRunning';
    this.description = undefined;
    this.command = {
      title: this.label,
      command: EXIT_JOB_COMMAND,
      tooltip: `Exits the CircleCI® job ${this.label}`,
      arguments: [this],
    };
    this.iconPath = new vscode.ThemeIcon('trash');
  }

  setIsNotRunning(): void {
    this.contextValue = undefined;
    this.description = undefined;
    this.command = {
      title: this.label,
      command: RUN_JOB_COMMAND,
      tooltip: `Runs the CircleCI® job ${this.label}`,
      arguments: [this.label, this],
    };
    this.iconPath = new vscode.ThemeIcon('debug-start');
  }

  setIsSuccess(): void {
    this.description = '✅';
  }

  setIsFailure(): void {
    this.description = '❌';
  }
}
