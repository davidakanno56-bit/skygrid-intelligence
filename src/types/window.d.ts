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
    setBillingCurrency: (currency: string) => void;
    selectPaymentRail: (rail: 'card' | 'wire') => void;
    initiateEnterpriseCheckout: () => void;
    completeEnterpriseOrder: () => void;
    downloadCurrentInvoice: () => void;
    navigateTo: (route: string) => void;
    submitPartnershipEnquiry: () => void;
    setLandingScenario: (scenario: string) => void;
    setLandingCurrency: (curr: string) => void;
    reinitRadar: () => void;
    viewLicensingPlans: () => void;
    requestEnterpriseAccess: () => void;
    requestEnterprisePlan: (planName: string) => void;
    FlutterwaveCheckout?: (config: unknown) => void;
  }
}

export { };

