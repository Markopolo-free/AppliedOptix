import { getDatabase, ref, push, serverTimestamp } from 'firebase/database';
import { AuditLog, AuditLogChange } from '../types';

interface LogAuditParams {
  userId: string;
  userName: string;
  userEmail: string;
  action: AuditLog['action'];
  entityType: AuditLog['entityType'];
  entityId?: string;
  entityName?: string;
  changes?: AuditLogChange[];
  metadata?: Record<string, any>;
}

/**
 * Logs an audit entry to Firebase Realtime Database
 * @param params - The audit log parameters
 * @returns Promise<string> - The ID of the created audit log entry
 */
export const logAudit = async (params: LogAuditParams): Promise<string> => {
  try {
    const database = getDatabase();
    const auditLogsRef = ref(database, 'auditLogs');

    // Create the audit log entry - only include defined values (Firebase doesn't allow undefined)
    const auditEntry: any = {
      userId: params.userId,
      userName: params.userName,
      userEmail: params.userEmail,
      action: params.action,
      entityType: params.entityType,
      timestamp: serverTimestamp(),
    };

    // Only add optional fields if they have values
    if (params.entityId !== undefined) {
      auditEntry.entityId = params.entityId;
    }
    if (params.entityName !== undefined) {
      auditEntry.entityName = params.entityName;
    }
    if (params.changes !== undefined && params.changes.length > 0) {
      // Firebase disallows undefined anywhere in the payload
      auditEntry.changes = params.changes.map((c) => ({
        field: c.field,
        oldValue: c.oldValue === undefined ? null : c.oldValue,
        newValue: c.newValue === undefined ? null : c.newValue,
      }));
    }
    if (params.metadata !== undefined) {
      auditEntry.metadata = params.metadata;
    }

    // Push to Firebase
    const newAuditRef = await push(auditLogsRef, auditEntry);

    console.log(`Audit log created: ${params.action} on ${params.entityType}`, newAuditRef.key);
    return newAuditRef.key || '';
  } catch (error) {
    console.error('Error logging audit entry:', error);
    throw error;
  }
};

/**
 * Helper function to calculate changes between old and new objects
 * @param oldData - The previous state of the object
 * @param newData - The new state of the object
 * @returns AuditLogChange[] - Array of changes detected
 */
export const calculateChanges = (
  oldData: Record<string, any>,
  newData: Record<string, any>
): AuditLogChange[] => {
  const changes: AuditLogChange[] = [];
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  allKeys.forEach((key) => {
    // Skip internal fields
    if (key === 'lastModifiedBy' || key === 'lastModifiedAt' || key === 'id') {
      return;
    }

    const oldValue = oldData[key];
    const newValue = newData[key];

    // Compare values (handling arrays and objects)
    const oldValueStr = JSON.stringify(oldValue);
    const newValueStr = JSON.stringify(newValue);

    if (oldValueStr !== newValueStr) {
      changes.push({
        field: key,
        // Ensure no undefined values are returned; Firebase forbids undefined
        oldValue: oldValue === undefined ? null : oldValue,
        newValue: newValue === undefined ? null : newValue,
      });
    }
  });

  return changes;
};
