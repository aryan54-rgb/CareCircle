import { ScheduledEvent, Context } from 'aws-lambda';

export async function handler(event: ScheduledEvent, context: Context) {
  console.log('CareCircle Weekly Digest triggered:', JSON.stringify(event));
  
  // Weekly digest logic will be added in Phase 8
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
}
