import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTradeCapabilities } from '../utils/tradeCapabilities';

/**
 * useTradeProfile Hook
 *
 * Provides current business trade settings, capability flags, and industry terminology.
 * When a merchant is on 'frozen_food', it safely preserves 100% of the cold-chain & batch workflows.
 * When on 'pharmacy', 'retail_general', etc., it activates category-specific features.
 */
export function useTradeProfile() {
  const { tenant, user } = useAuth();
  
  const rawBusinessType = tenant?.business_type || user?.business_type || 'frozen_food';

  const tradeProfile = useMemo(() => {
    return getTradeCapabilities(rawBusinessType);
  }, [rawBusinessType]);

  return {
    ...tradeProfile,
    rawBusinessType,
    isFrozenFood: tradeProfile.id === 'frozen_food',
    isPharmacy: tradeProfile.id === 'pharmacy',
    isRetail: tradeProfile.id === 'retail_general',
    isClothing: tradeProfile.id === 'clothing',
    isRestaurant: tradeProfile.id === 'restaurant',
    isHardware: tradeProfile.id === 'hardware',
    isWholesale: tradeProfile.id === 'wholesale',
    isGrocery: tradeProfile.id === 'grocery'
  };
}

export default useTradeProfile;

