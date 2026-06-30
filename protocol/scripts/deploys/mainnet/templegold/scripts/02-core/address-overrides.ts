import { ContractAddresses } from "../../contract-addresses/types";

export function applyOverrides(addrs: ContractAddresses): ContractAddresses {
  addrs.TEMPLE_GOLD.TEMPLE_GOLD_ADMIN = '0xb1F2C5c1ea2885278a1070350d12d3D8824265B0';
  addrs.TEMPLE_GOLD.TEMPLE_TELEPORTER = '0x0A3EE490d067C266Ceb6f17aA43bBE7732Ed11c9';
  return addrs;
}