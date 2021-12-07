import * as fs from 'fs';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import Command from './Command';
import Job from './Job';
import Warning from './Warning';
import getJobs from '../utils/getJobs';
import getProcessedConfig from '../utils/getProcessedConfig';
import {
  GET_LICENSE_COMMAND,
  ENTER_LICENSE_COMMAND,
  TRIAL_STARTED_TIMESTAMP,
  JOB_TREE_VIEW_ID,
} from '../constants';
import getAllConfigFilePaths from '../utils/getAllConfigFilePaths';
import getConfigFilePath from '../utils/getConfigFilePath';
import getDockerError from '../utils/getDockerError';
import getProcessFilePath from '../utils/getProcessFilePath';
import getTrialLength from '../utils/getTrialLength';
import isDockerRunning from '../utils/isDockerRunning';
import isLicenseValid from '../utils/isLicenseValid';
import isTrialExpired from '../utils/isTrialExpired';
import writeProcessFile from '../utils/writeProcessFile';

export default class JobProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<Job | undefined> =
    new vscode.EventEmitter<Job | undefined>();
  readonly onDidChangeTreeData: vscode.Event<Job | undefined> =
    this._onDidChangeTreeData.event;
  private jobs: vscode.TreeItem[] | [] = [];
  private runningJob: string | undefined;
  private suppressMessage: boolean | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly reporter: TelemetryReporter
  ) {}

  refresh(job?: Job, suppressMessage?: boolean): void {
    this.suppressMessage = suppressMessage;
    this._onDidChangeTreeData.fire(job);
  }

  getTreeItem(element: Job): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<vscode.TreeItem[]> {
    const configFilePath = await getConfigFilePath(this.context);
    if (!configFilePath || !fs.existsSync(configFilePath)) {
      this.reporter.sendTelemetryErrorEvent('configFilePath');

      return [
        new Warning('Error: No jobs found'),
        (await getAllConfigFilePaths(this.context)).length
          ? new Command('Select repo', 'localCiJobs.selectRepo')
          : new vscode.TreeItem(
              'Please add a .circleci/config.yml to this workspace'
            ),
      ];
    }

    let processedConfig = '';
    let processError = '';
    try {
      processedConfig = getProcessedConfig(configFilePath);
      writeProcessFile(processedConfig, getProcessFilePath(configFilePath));
    } catch (e) {
      processError = (e as ErrorWithMessage)?.message;
      if (!this.suppressMessage) {
        vscode.window.showErrorMessage(
          `There was an error processing the CircleCI config: ${
            (e as ErrorWithMessage)?.message
          }`
        );
      }

      this.reporter.sendTelemetryErrorEvent('writeProcessFile');
    }

    const shouldEnableExtension =
      (await isLicenseValid(this.context)) ||
      !isTrialExpired(
        this.context.globalState.get(TRIAL_STARTED_TIMESTAMP),
        getTrialLength(this.context)
      );
    const dockerRunning = isDockerRunning();

    if (shouldEnableExtension && dockerRunning) {
      this.jobs = processError
        ? [
            new Warning('Error processing the CircleCI config:'),
            new vscode.TreeItem(processError),
            new Command('Try Again', `${JOB_TREE_VIEW_ID}.refresh`),
          ]
        : await getJobs(this.context, processedConfig, this.runningJob);
      this.runningJob = undefined;
    }

    if (!dockerRunning) {
      this.reporter.sendTelemetryErrorEvent('dockerRunning');
    }

    if (!this.jobs.length) {
      this.reporter.sendTelemetryErrorEvent('noJobsFound');
    }

    return shouldEnableExtension
      ? dockerRunning
        ? this.jobs
        : [
            new Warning('Error: is Docker running?'),
            new vscode.TreeItem(`${getDockerError()}`),
            new Command('Try Again', `${JOB_TREE_VIEW_ID}.refresh`),
          ]
      : [
          new Warning('Please enter a Local CI license key.'),
          new Command('Get License', GET_LICENSE_COMMAND),
          new Command('Enter License', ENTER_LICENSE_COMMAND),
        ];
  }

  getJob(jobName: string): vscode.TreeItem | undefined {
    return this.jobs.find((job) => jobName === (job as Job)?.getJobName());
  }

  setRunningJob(jobName: string): void {
    this.runningJob = jobName;
  }
}
