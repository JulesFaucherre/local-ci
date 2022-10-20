import { injectable } from 'inversify';
import * as path from 'path';
import getAttachWorkspaceCommand from 'config/getAttachWorkspaceCommand';
import getRestoreCacheCommand from 'cache/getRestoreCacheCommand';
import getSaveCacheCommand from 'cache/getSaveCacheCommand';
import getSaveCacheSteps from 'cache/getSaveCacheSteps';
import {
  CONTAINER_STORAGE_DIRECTORY,
  CONTINUE_PIPELINE_STEP_NAME,
  DYNAMIC_CONFIG_PARAMETERS_FILE_NAME,
  DYNAMIC_CONFIG_PATH_IN_CONTAINER,
} from 'constant';

@injectable()
export default class ProcessFile {
  replaceSteps(job: Job, config: CiConfig): Job['steps'] {
    return job.steps?.map((step: Step) => {
      if (typeof step === 'string') {
        return step;
      }

      if (step?.attach_workspace) {
        return {
          run: {
            name: 'Attach workspace',
            command: getAttachWorkspaceCommand(step),
          },
        };
      }

      if (step?.persist_to_workspace) {
        return {
          run: {
            name: 'Persist to workspace',
            command: this.getPersistToWorkspaceCommand(step),
          },
        };
      }

      if (step?.restore_cache) {
        return {
          run: {
            name: 'Restore cache',
            command: getRestoreCacheCommand(step, getSaveCacheSteps(config)),
          },
        };
      }

      if (step?.save_cache) {
        return {
          run: {
            name: 'Save cache',
            command: getSaveCacheCommand(step),
          },
        };
      }

      // Look for the circleci/continuation orb, which continues a dynamic config.
      // That orb is also in the circleci/path-filtering orb.
      // https://circleci.com/developer/orbs/orb/circleci/continuation
      // https://circleci.com/developer/orbs/orb/circleci/path-filtering
      if (
        typeof step?.run !== 'string' &&
        step?.run?.command?.includes('$CIRCLE_CONTINUATION_KEY') &&
        step?.run?.environment &&
        step?.run?.environment['CONFIG_PATH']
      ) {
        const outputPath = this.getOutputPath(job.steps);

        return {
          run: {
            name: CONTINUE_PIPELINE_STEP_NAME,
            command: `if [ -f ${DYNAMIC_CONFIG_PATH_IN_CONTAINER} ]
            then
              rm ${DYNAMIC_CONFIG_PATH_IN_CONTAINER}
            fi
            cp ${
              step?.run?.environment['CONFIG_PATH']
            } ${DYNAMIC_CONFIG_PATH_IN_CONTAINER}
            ${
              outputPath
                ? `if [ -f ${outputPath} ]
                  then
                    cp ${outputPath} ${path.join(
                    CONTAINER_STORAGE_DIRECTORY,
                    DYNAMIC_CONFIG_PARAMETERS_FILE_NAME
                  )}
                  fi`
                : ``
            }`,
          },
        };
      }

      if (this.isCustomClone(step)) {
        return 'checkout';
      }

      return step;
    });
  }

  /**
   * Gets the output-path environment variable from the path-filtering orb.
   *
   * https://circleci.com/developer/orbs/orb/circleci/path-filtering#commands
   */
  getOutputPath(steps: Job['steps']): string | undefined {
    if (!steps) {
      return;
    }

    for (const step of steps) {
      if (
        typeof step !== 'string' &&
        typeof step?.run !== 'string' &&
        step?.run?.environment &&
        step?.run?.environment['OUTPUT_PATH']
      ) {
        return step?.run?.environment['OUTPUT_PATH'];
      }
    }
  }

  getPersistToWorkspaceCommand(step: FullStep): string {
    if (typeof step?.persist_to_workspace?.paths === 'string') {
      const pathToPersist = path.join(
        step?.persist_to_workspace?.root ?? '.',
        step?.persist_to_workspace?.paths
      );

      return `echo "Persisting ${pathToPersist}"
        cp -Lr ${pathToPersist} ${CONTAINER_STORAGE_DIRECTORY}`;
    }

    return (
      step?.persist_to_workspace?.paths.reduce((accumulator, workspacePath) => {
        const pathToPersist = path.join(
          step?.persist_to_workspace?.root ?? '.',
          workspacePath
        );

        return `${accumulator} echo "Persisting ${pathToPersist}"
          cp -Lr ${pathToPersist} ${CONTAINER_STORAGE_DIRECTORY}\n`;
      }, '') ?? ''
    );
  }

  /**
   * Gets whether this is a custom `git clone` command.
   *
   * Local CI doesn't work with that.
   * The idea of Local CI is to use your local commits, not to git clone from the remote repo.
   * So this will find if there's a custom `git clone` command,
   * so it can replace it with `checkout`.
   * The CLI handles `checkout` well.
   */
  isCustomClone(step: FullStep): boolean {
    const clonePattern = /git clone[^\n]+\$CIRCLE_REPOSITORY_URL/;
    return (
      (typeof step?.run === 'string' && !!step.run.match(clonePattern)) ||
      (typeof step?.run !== 'string' &&
        !!step?.run?.command?.match(clonePattern))
    );
  }
}
