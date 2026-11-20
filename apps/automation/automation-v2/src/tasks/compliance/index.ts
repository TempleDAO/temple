/**
 * Compliance: keeps each Deployment's Flagged addresses in line with its
 * Target set, and excludes Flagged Depositors from Granary Auctions.
 * Start with README.md.
 */
export { complianceTasks } from './tasks';
export { COMPLIANCE_DEPLOYMENTS, COMPLIANCE_SEPOLIA } from './config';
export { compliance_exempt, compliance_manual_source } from './variables';
