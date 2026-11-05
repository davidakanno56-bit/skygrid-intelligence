import type { CommercialTierKey } from './licensing';

declare global {
  interface Window {
    initMapLibreRadar: () => void;
    initThreeRadar: () => void;
    selectLicensingTier: (tier: CommercialTierKey | string) => void;
    handleCorridorChange: (corridorKey: string) => void;
    toggleAudioFeedback: () => void;
    setRadarViewMode: (mode: '3d' | '2d') => void;
    toggleLayer: (layer: 'vectors' | 'sweep') => void;
    recenterRadar: (playSound?: boolean) => void;
    zoomRadar: (factor: number) => void;
    setFlightFilter: (filter: string) => void;
    filterFlights: () => void;
    openFlightModal: (flightId: string) => void;
    closeFlightModal: () => void;
    executeFlightDeconfliction: () => void;
    focusOnFlightInRadar: () => void;
    openDirectivesModal: () => void;
    closeDirectivesModal: () => void;
    triggerDeconflictSimulation: () => void;
    openEnterprisePortal: (initialTab?: string) => void;
    closeEnterprisePortal: () => void;
    switchPortalTab: (tabName: string) => void;
    generatePartnerApiKey: () => void;
    copyRawApiKey: () => void;
    revokeApiKey: (keyId: number) => void;
    testApiEndpoint: (path: string, method?: string, body?: unknown) => void;
    registerWebhook: () => void;
    deleteWebhook: (id: number) => void;
    triggerManualTestDispatch: () => void;
    refreshAuditLogs: () => void;
    saveIngestionApiKeys: () => void;
    saveDatabaseConfig: () => void;
  }
}

export {};

