import { useQuery } from '@tanstack/react-query';

// Note: this is hardcoded to use the TEMPLE token on Ethereum mainnet
// We could make this dynamic by using the token address from the env
interface PriceResponse {
  coins: {
    'ethereum:0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7': {
      decimals: number;
      symbol: string;
      price: number;
      timestamp: number;
      confidence: number;
    };
  };
}

const TEMPLE_PRICE_URL =
  'https://coins.llama.fi/prices/current/ethereum:0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7';

export const useTemplePrice = () => {
  const { data, isLoading, error } = useQuery<PriceResponse>({
    queryKey: ['temple-price'],
    queryFn: async () => {
      const response = await fetch(TEMPLE_PRICE_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch TEMPLE price');
      }
      return response.json();
    },
    // Refresh every 5 minutes
    refetchInterval: 5 * 60 * 1000,
    // Keep data fresh for 5 minutes
    staleTime: 5 * 60 * 1000,
  });

  return {
    price:
      data?.coins['ethereum:0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7']?.price,
    isLoading,
    error,
  };
};
