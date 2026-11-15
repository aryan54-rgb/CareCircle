import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

let cachedJwtSecret: string | null = null;

export const config = {
  tableName: process.env.TABLE_NAME || 'carecircle-dev-table',
  sesFrom: process.env.SES_FROM || 'carecircle-demo@carecircle.local',
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || 'https://odu8ihixga.execute-api.ap-south-1.amazonaws.com',
  jwtParamName: process.env.JWT_PARAM_NAME || '/carecircle/jwt-secret',
  bedrockRegion: process.env.BEDROCK_REGION || 'us-east-1',
  bedrockModelId: process.env.BEDROCK_MODEL_ID || 'us.amazon.nova-2-lite-v1:0',
  mailDriver: (process.env.MAIL_DRIVER || 'ses') as 'ses' | 'smtp' | 'log',
  isDemoMode: process.env.DEMO_MODE === 'true',
  awsRegion: process.env.AWS_REGION || 'ap-south-1',

  async getJwtSecret(): Promise<string> {
    if (cachedJwtSecret) return cachedJwtSecret;
    if (process.env.JWT_SECRET) {
      cachedJwtSecret = process.env.JWT_SECRET;
      return cachedJwtSecret;
    }

    try {
      const ssm = new SSMClient({ region: this.awsRegion });
      const res = await ssm.send(
        new GetParameterCommand({
          Name: this.jwtParamName,
          WithDecryption: true,
        })
      );
      if (res.Parameter?.Value) {
        cachedJwtSecret = res.Parameter.Value;
        return cachedJwtSecret;
      }
    } catch (err) {
      console.warn('Could not fetch JWT secret from SSM, using fallback local secret', err);
    }

    cachedJwtSecret = 'carecircle-fallback-dev-secret-key-32chars!';
    return cachedJwtSecret;
  },
};
