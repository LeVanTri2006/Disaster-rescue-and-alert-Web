import { Injectable, Logger } from '@nestjs/common';
import { cert, getApps, initializeApp, App } from 'firebase-admin/app';
import { getAuth, Auth, DecodedIdToken } from 'firebase-admin/auth';
import { getDatabase, Database } from 'firebase-admin/database';

export type SosRealtimeProjection = {
  eventId: string;
  status: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  adults: number;
  children: number;
  elderly: number;
  neededItems: string[];
  condition: string | null;
  urgency: string | null;
  photoUrl: string | null;
  photos: string[];
  createdAt: string;
  batteryPercent: number | null;
  updatedAt: string;
};

export interface SosRealtimePublisher {
  readonly enabled: boolean;
  publish(ownerId: string, projection: SosRealtimeProjection): Promise<void>;
  createCustomToken(userId: string, role: string): Promise<string>;
  verifyIdToken(idToken: string): Promise<DecodedIdToken>;
  createUser(email?: string, phone?: string, password?: string, displayName?: string): Promise<string>;
}

export function buildSosRealtimeUpdates(
  ownerId: string,
  projection: SosRealtimeProjection,
): Record<string, SosRealtimeProjection> {
  return {
    [`sos-events/${projection.eventId}`]: projection,
    [`sos-owner-events/${ownerId}/${projection.eventId}`]: projection,
  };
}

@Injectable()
export class FirebaseSosPublisher implements SosRealtimePublisher {
  private readonly logger = new Logger(FirebaseSosPublisher.name);
  private readonly app?: App;
  private readonly database?: Database;
  private readonly auth?: Auth;

  constructor() {
    const databaseUrl = process.env.FIREBASE_DATABASE_URL?.trim();
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    if (!databaseUrl || !serviceAccountJson) {
      this.logger.warn('Firebase RTDB publisher disabled: Firebase server configuration is missing');
      return;
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountJson) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };

      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      const existing = getApps().find((candidate) => candidate.name === 'sos-realtime');
      this.app = existing ?? initializeApp(
        {
          credential: cert(serviceAccount as any),
          databaseURL: databaseUrl,
        },
        'sos-realtime',
      );
      this.database = getDatabase(this.app);
      this.auth = getAuth(this.app);
      this.logger.log(`Firebase RTDB publisher enabled for ${serviceAccount.project_id ?? 'configured project'}`);
    } catch (error) {
      this.logger.error('Firebase RTDB publisher disabled: invalid Firebase server configuration', error);
    }
  }

  get enabled(): boolean {
    return Boolean(this.database && this.auth);
  }

  async publish(ownerId: string, projection: SosRealtimeProjection): Promise<void> {
    if (!this.database) {
      this.logger.warn('Firebase RTDB publisher disabled: Firebase server configuration is missing or invalid');
      return;
    }

    const updates = buildSosRealtimeUpdates(ownerId, projection);
    this.logger.log(`FIREBASE_REALTIME_PUBLISH_START: eventId=${projection.eventId}, status=${projection.status}, path=sos-events/${projection.eventId}`);
    const timeoutPromise = new Promise<void>((_, reject) => 
      setTimeout(() => reject(new Error('Firebase RTDB publish request timed out after 5000ms')), 5000)
    );
    
    try {
      await Promise.race([
        this.database.ref().update(updates),
        timeoutPromise
      ]);
      this.logger.log(`FIREBASE_REALTIME_PUBLISH_SUCCESS: eventId=${projection.eventId}`);
    } catch (error) {
      this.logger.error(`FIREBASE_REALTIME_PUBLISH_FAILED: eventId=${projection.eventId}, error=${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createCustomToken(userId: string, role: string): Promise<string> {
    if (!this.auth) {
      throw new Error('Firebase server configuration is unavailable');
    }
    return this.auth.createCustomToken(userId, { role });
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    if (!this.auth) {
      throw new Error('Firebase server configuration is unavailable');
    }
    return this.auth.verifyIdToken(idToken);
  }

  async createUser(email?: string, phone?: string, password?: string, displayName?: string): Promise<string> {
    if (!this.auth) {
      throw new Error('Firebase server configuration is unavailable');
    }
    const userRecord = await this.auth.createUser({
      email,
      phoneNumber: phone,
      password,
      displayName,
    });
    return userRecord.uid;
  }
}
