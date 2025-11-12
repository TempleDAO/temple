import { useState, useEffect, useMemo } from 'react';
import { getAppConfig } from 'constants/newenv';
import { allVestingSchedules, useCachedSubgraphQuery } from 'utils/subgraph';

// Helper function to validate Ethereum address format
function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

// Custom debounce hook
function useDebounce(value: string, delay: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

type UseAddressValidationReturn = {
  isValid: boolean; // true if both format + existence pass
  validatedAddress: string | null; // the clean address or null
  isChecking: boolean; // true while validating existence
};

export const useAddressValidation = (
  searchInput: string
): UseAddressValidationReturn => {
  const subgraphUrl = getAppConfig().vesting.subgraphUrl;

  // Debounce the search input
  const debouncedInput = useDebounce(searchInput, 300);

  // Fetch all vesting schedules to get valid addresses
  const { data: schedulesResponse, isLoading: isLoadingSchedules } =
    useCachedSubgraphQuery(subgraphUrl, allVestingSchedules());

  // Process validation
  const validation = useMemo(() => {
    // If input is empty, return not valid
    if (!debouncedInput.trim()) {
      return {
        isValid: false,
        validatedAddress: null,
        isChecking: false,
      };
    }

    // Check format first
    const cleanAddress = debouncedInput.trim().toLowerCase();
    if (!isValidEthereumAddress(cleanAddress)) {
      return {
        isValid: false,
        validatedAddress: null,
        isChecking: false,
      };
    }

    // If still loading schedules, show checking state
    if (isLoadingSchedules) {
      return {
        isValid: false,
        validatedAddress: null,
        isChecking: true,
      };
    }

    // Check if address exists in vesting schedules
    const schedules = schedulesResponse?.schedules || [];
    const addressExists = schedules.some(
      (schedule) => schedule.recipient.id.toLowerCase() === cleanAddress
    );

    return {
      isValid: addressExists,
      validatedAddress: addressExists ? cleanAddress : null,
      isChecking: false,
    };
  }, [debouncedInput, schedulesResponse, isLoadingSchedules]);

  return validation;
};
