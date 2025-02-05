import { inject, injectable } from 'inversify';
import ChildProcessGateway from 'gateway/ChildProcessGateway';
import Spawn from 'common/Spawn';
import Types from 'common/Types';

@injectable()
class Docker {
  @inject(Types.IChildProcessGateway)
  childProcessGateway!: ChildProcessGateway;

  @inject(Spawn)
  spawn!: Spawn;

  getError(): string {
    try {
      this.childProcessGateway.cp.execSync('docker info', {
        ...this.spawn.getOptions(),
        timeout: 2000,
      });
    } catch (error) {
      return (error as ErrorWithMessage)?.message ?? '';
    }

    return '';
  }

  isRunning(): boolean {
    return !this.getError()?.length;
  }
}

export default Docker;
