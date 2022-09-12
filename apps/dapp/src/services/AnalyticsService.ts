import env from 'constants/env';
import posthog from 'posthog-js';
import { isDevelopmentEnv } from 'utils/helpers';

export class AnalyticsService {
  private constructor() {}

  public static init(): void {
    if (!isDevelopmentEnv()) {
      if (!env.posthog) {
        throw new Error('Missing posthog config');
      }
      posthog.init(env.posthog.token, { api_host: env.posthog.api_host });
    }
  }

  public static captureEvent(eventKey: string, eventProperties: Object): void {
    if (!isDevelopmentEnv()) {
      posthog.capture(eventKey, eventProperties);
    }
  }
}
