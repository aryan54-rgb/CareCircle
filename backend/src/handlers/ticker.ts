import { ScheduledEvent, Context } from 'aws-lambda';

export async function handler(event: ScheduledEvent | { task?: string }, context: Context) {
  console.log('CareCircle Ticker triggered:', JSON.stringify(event));
  
  if ('task' in event && event.task === 'extend-horizon') {
    console.log('Executing daily horizon extension task...');
    // Future phase logic
    return { status: 'horizon-extended' };
  }

  // 1-minute tick logic will be added in Phase 3
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
}
