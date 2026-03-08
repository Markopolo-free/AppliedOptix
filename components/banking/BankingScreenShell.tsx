import React, { useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../services/auditService';

interface BankingScreenShellProps {
  title: string;
  description: string;
  functionalKeys: Array<{ key: string; action: string }>;
  entityName: string;
}

const BankingScreenShell: React.FC<BankingScreenShellProps> = ({
  title,
  description,
  functionalKeys,
  entityName,
}) => {
  const { currentUser, effectiveTenantId } = useAuth();

  const keyMap = useMemo(() => {
    return functionalKeys.reduce<Record<string, string>>((acc, item) => {
      acc[item.key.toLowerCase()] = item.action;
      return acc;
    }, {});
  }, [functionalKeys]);

  useEffect(() => {
    if (!currentUser) return;

    logAudit({
      userId: currentUser.email,
      userName: currentUser.name,
      userEmail: currentUser.email,
      action: 'initialize',
      entityType: 'reference',
      entityName,
      metadata: {
        tenantId: effectiveTenantId,
        screen: title,
        scope: 'banking-interest-mvp',
        timestamp: new Date().toISOString(),
      },
    }).catch((error) => {
      console.warn('Audit log failed for screen initialize:', error);
    });
  }, [currentUser, effectiveTenantId, entityName, title]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const action = keyMap[event.key.toLowerCase()];
      if (!action || !currentUser) return;

      event.preventDefault();
      logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: 'update',
        entityType: 'reference',
        entityName,
        metadata: {
          tenantId: effectiveTenantId,
          screen: title,
          functionalKey: `Alt+${event.key.toUpperCase()}`,
          actionLabel: action,
          timestamp: new Date().toISOString(),
        },
      }).catch((error) => {
        console.warn('Audit log failed for functional key action:', error);
      });
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentUser, effectiveTenantId, entityName, title, keyMap]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">{title}</h1>
        <p className="text-gray-600">{description}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Functional Keys</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {functionalKeys.map((item) => (
            <div key={item.key} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-gray-700">{item.action}</span>
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{item.key}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-dashed border-gray-300 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">MVP Delivery Note</h3>
        <p className="text-gray-600 text-sm">
          This screen is scaffolded behind the banking feature flag and follows existing portal patterns for layout,
          auditability, and incremental release.
        </p>
      </div>
    </div>
  );
};

export default BankingScreenShell;
