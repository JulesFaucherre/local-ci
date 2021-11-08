import { TRIAL_LENGTH_IN_MILLISECONDS } from '../constants';
const hourInMilliseconds = 3600000;

export default function getHoursRemainingInTrial(
  currentTimeStamp: number,
  trialStartedTimeStamp: number | unknown
): number {
  const previewTimeElapsed = currentTimeStamp - Number(trialStartedTimeStamp);

  return trialStartedTimeStamp
    ? Math.ceil(
        (TRIAL_LENGTH_IN_MILLISECONDS - previewTimeElapsed) / hourInMilliseconds
      )
    : 0;
}