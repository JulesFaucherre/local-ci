import { inject, injectable } from 'inversify';
import type vscode from 'vscode';
import type { Command } from './index';
import {
  CREATE_CONFIG_FILE_COMMAND,
  JOB_TREE_VIEW_ID,
  SELECTED_CONFIG_PATH,
} from 'constants/';
import Types from 'common/Types';
import JobProvider from 'job/JobProvider';
import ReporterGateway from 'common/ReporterGateway';
import EditorGateway from 'common/EditorGateway';
import CommittedImages from 'containerization/CommittedImages';
import AllConfigFiles from 'config/AllConfigFiles';
import getRepoBasename from 'common/getRepoBasename';

@injectable()
export default class SelectRepo implements Command {
  @inject(AllConfigFiles)
  allConfigFiles!: AllConfigFiles;

  @inject(Types.IEditorGateway)
  editorGateway!: EditorGateway;

  @inject(Types.IReporterGateway)
  reporterGateway!: ReporterGateway;

  @inject(CommittedImages)
  committedImages!: CommittedImages;

  commandName: string;

  constructor() {
    this.commandName = `${JOB_TREE_VIEW_ID}.selectRepo`;
  }

  getCallback(context: vscode.ExtensionContext, jobProvider: JobProvider) {
    return async () => {
      this.reporterGateway.reporter.sendTelemetryEvent('selectRepo');

      const createConfigText = 'Create a config for me';
      const quickPick = this.editorGateway.editor.window.createQuickPick();
      const configFilePaths = await this.allConfigFiles.getPaths(context);
      quickPick.title = 'Repo to run CI on';
      quickPick.items = configFilePaths.length
        ? configFilePaths
        : [
            {
              label: 'No config file found',
              description:
                'A .circleci/config.yml file is needed to run Local CI',
            },
            {
              label: createConfigText,
            },
          ];
      quickPick.onDidChangeSelection((selection) => {
        if (selection.length && selection[0].label === createConfigText) {
          this.editorGateway.editor.commands.executeCommand(
            CREATE_CONFIG_FILE_COMMAND
          );
        }
        if (
          selection?.length &&
          (selection[0] as ConfigFileQuickPick)?.fsPath
        ) {
          const selectedFsPath = (selection[0] as ConfigFileQuickPick)?.fsPath;
          context.globalState
            .update(SELECTED_CONFIG_PATH, selectedFsPath)
            .then(() => {
              jobProvider.hardRefresh();
              this.editorGateway.editor.window.showInformationMessage(
                `The repo ${getRepoBasename(selectedFsPath)} is now selected`
              );

              this.editorGateway.editor.commands.executeCommand(
                'workbench.view.extension.localCiDebugger'
              );
            });
        }

        quickPick.dispose();
      });
      quickPick.onDidHide(() => quickPick.dispose());
      quickPick.show();
    };
  }
}
