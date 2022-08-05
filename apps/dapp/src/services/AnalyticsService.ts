import env from 'constants/env';
import posthog from 'posthog-js';
import { isDevelopmentEnv } from 'utils/helpers';

export class AnalyticsService {
  private static instance: AnalyticsService;
  private static shouldSendAnalytics: boolean;

  private constructor() {
    AnalyticsService.shouldSendAnalytics = !isDevelopmentEnv();
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
        AnalyticsService.instance = new AnalyticsService();
    }

    return AnalyticsService.instance;
  }

  init(): void {
    if (AnalyticsService.shouldSendAnalytics) {
      if (!env.posthog) {
        throw new Error('Missing posthog config');
      }
      posthog.init(env.posthog.token, { api_host: env.posthog.api_host });
    }
  }

  captureEvent(eventKey: string, eventProperties: Object): void {
    if (AnalyticsService.shouldSendAnalytics) {
      posthog.capture(eventKey, eventProperties);
    }
  }
}
